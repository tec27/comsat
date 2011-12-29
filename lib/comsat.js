var fs = require('fs')
  , EventEmitter = require('events').EventEmitter
  , path = require('path')
  , util = require('util')
  , async = require('async')
  , BigInteger = require('bigdecimal').BigInteger
  , mpyq = require('./mpyq')
  , comsat_util = require('./comsat_util')
  , headerParser = require('./parsers/header')
  , detailsParser = require('./parsers/details')
  , attributesParser = require('./parsers/attributes')
  , messagesParser = require('./parsers/messages')

function Replay(filename) {
  this.filename = filename;
  this._loaded = false;

  EventEmitter.call(this);
}

util.inherits(Replay, EventEmitter);

Replay.prototype._processHeader = function(data) {
  this.info = new Info();

  var hVersion = data.header.version;
  this.info.version = { major: hVersion.major, minor: hVersion.minor, patch: hVersion.patch, build: hVersion.build };
  this.info.gameLength = data.header.game_length;
}

Replay.prototype._processDetails = function(details) {
  for(var i = 0; i < details.players.length; i++) {
    var detailPlayer = details.players[i];
    var newPlayer = this.players[i] = this.players[i] || new Player();
    newPlayer.name = detailPlayer.name;
    newPlayer.bnetId = detailPlayer.idInfo.realId;
    newPlayer.color = newPlayer.color || { };
    newPlayer.color.argb = detailPlayer.color;
    newPlayer.handicap = detailPlayer.handicap;
    newPlayer.outcome = detailPlayer.outcome;
    // TODO: we can pull actual race for random players from replay.details, but the text is localized. Either build a conversion function or pull this data from game events
  }

  this.info.region = details.mapFiles[0].region.toUpperCase();
  var unixDate = details.datetime.subtract(new BigInteger('116444735995904000')).divide(BigInteger.valueOf(10).pow(7)).intValue(); // converts from Windows nano time to unix time (so we don't have to deal with bigints outside of this module)
  var timezoneOffsetSec = details.timezoneOffset.divide(BigInteger.valueOf(10).pow(7)).intValue();
  this.info.date = { value: unixDate, timezoneOffset: timezoneOffsetSec };
  this.info.numPlayers = details.players.length;
}

Replay.prototype._processAttributes = function(attributes) {
  var attrNames = attributesParser.attributeNames;
  if(attributes[attrNames.PlayerType]) {
    var attrib = attributes[attrNames.PlayerType];
    // remap players array using this info, since it doesn't take into account open slots
    if(this.players.length > 0) {
      var newPlayerArray = [ ];
      for(var i = 0, playerIdx = 0; i < attrib.length; i++) {
        if(attrib[i] == 'Open') continue;
        newPlayerArray[i] = this.players[playerIdx++] || new Player();
      }
      this.players = newPlayerArray;
    }

    for(var i = 0; i < attrib.length; i++) {
      var type = attributesParser.playerType(attrib[i]);
      if(type != 'Open') {
        this.players[i] = this.players[i] || new Player();
        this.players[i].playerType = type;

        if(attributes[attrNames.PlayerRace] && attributes[attrNames.PlayerRace][i])
          this.players[i].race = attributesParser.playerRace(attributes[attrNames.PlayerRace][i]);

        if(attributes[attrNames.PlayerColor] && attributes[attrNames.PlayerColor][i])
          this.players[i].color.name = attributesParser.playerColor(attributes[attrNames.PlayerColor][i]);

        if(attributes[attrNames.Difficulty] && attributes[attrNames.Difficulty][i])
          this.players[i].difficulty = attributesParser.difficulty(attributes[attrNames.Difficulty][i]);
      }
    }
  }
  var teamAttrib = null;
  if(attributes[attrNames.Format]) {
    this.info.format = attributesParser.format(attributes[attrNames.Format][15]);
    if(this.info.format !== 'Custom') teamAttrib = 'Teams' + this.info.format;
  }
  if(attributes[attrNames.GameSpeed]) {
    this.info.speed = attributesParser.gameSpeed(attributes[attrNames.GameSpeed][15]);
  }
  if(attributes[attrNames.GameType]) {
    this.info.gameType = attributesParser.gameType(attributes[attrNames.GameType][15]);
  }
  if(teamAttrib && attributes[attrNames[teamAttrib]]) {
    var attrib = attributes[attrNames[teamAttrib]];
    this.info.teams = this.info.teams || [];
    var winningTeam = -1;
    for(var i = 0; i < attrib.length; i++) {
      var teamNum = (attrib[i].split('T')[1] * 1) - 1;
      this.players[i].team = teamNum;
      this.info.teams[teamNum] = this.info.teams[teamNum] || [];
      this.info.teams[teamNum].push(this.players[i]);

      if(this.players[i].isWinner()) winningTeam = teamNum;
    }

    if(winningTeam > -1) {
      for(var i = 0; i < this.players.length; i++) {
        if(this.players[i] && this.players[i].team === winningTeam)
          this.players[i].outcome = 1;
        else if(this.players[i])
          this.players[i].outcome = 2;
      }
    }
  }
}

Replay.prototype._mergeData = function(data, callback) {
  if(!data.header && !data.details && !data.attributes && !data.messages) { // TODO: add the rest of the data files to this list
    callback(new Error('No replay data files could be read!'));
    return;
  }

  this.players = [];
  this.map = new Map();
  this.messages = [];
  this.actions = [];

  if(!this.info && data.header) {
    this._processHeader(data);
  }

  if(data.details) {
    this._processDetails(data.details);
  }

  if(data.attributes) {
    this._processAttributes(data.attributes);
  }

  // TODO: stream this and output action per message parse
  if(data.messages) {
    var notRecorder = [ ];
    for(var i = 0; i < data.messages.length; i++) {
      var event = data.messages[i];
      if(event.flags == 0x83) {
        // TODO: is this a map ping? FIND OUT MOFO
        continue;
      }
      else if(event.flags == 0x80) {
        // only sent by players other than the recorder, mark them as not the recorder
        notRecorder[event.playerId-1] = true;
        continue;
      }
      else {
        // actual, real live chat message!
        var chatMessage = new ChatMessage(this.players[event.playerId-1], event.payload.channel, event.frame, event.payload.message);
        this.messages.push(chatMessage);
      }
    }

    var possibleRecorders = [ ];
    for(var i = 0; i < this.players.length; i++) {
      if(!notRecorder[i]) possibleRecorders.push(this.players[i]);
    }
    if(possibleRecorders.length === 1) this.info.recordedBy = possibleRecorders[0];
  }

  this._loaded = true;
  callback();
}

Replay.prototype.load = function(deleteFile, callback) {
  var self = this;
  mpyq.extractReplay(self.filename, deleteFile, function(err,extractDir) { self._onExtractReplay(err, extractDir, deleteFile, callback); });
}

Replay.prototype._onExtractReplay = function(err, extractDir, deleteFile, callback) {
  if(err) {
    callback(err);
    return;
  }
  var self = this;

  var headerFile = path.join(extractDir, 'replay.header');

  // later parsers need version info from the replay header to function properly, so we parse the header and then do the rest parallel
  fs.readFile(headerFile, function onHeaderRead(err, data) { self._onHeaderRead(err, data, extractDir, deleteFile, callback); });
}

Replay.prototype._onHeaderRead = function(err, data, extractDir, deleteFile, callback) {
  if(err) {
    callback(err);
    return;
  }

  var self = this;
  headerParser.parse(err, data, function onHeaderParsed(err, header) { self._onHeaderParsed(err, header, extractDir, deleteFile, callback); });
}

Replay.prototype._onHeaderParsed = function(err, header, extractDir, deleteFile, callback) {
  if(err) {
    callback(err);
    return;
  }

  var self = this;

  self._processHeader({ header: header });
  var version = self.info.version;

  var detailsFile = path.join(extractDir, 'replay.details');
  var attributesFile = path.join(extractDir, 'replay.attributes.events');
  var messagesFile = path.join(extractDir, 'replay.message.events');
  var gameEventsFile = path.join(extractDir, 'replay.game.events');

  // TODO: make these parsers parse in a specific order so we can emit events at the right time.
  // Basically:
  // Header -> Process -> Details, Attributes -> Process -> Emit 'PartialInfo' -> Chat -> Emit 'Chat' for each message -> Process ->
  //        -> Actions -> Emit 'Action' for each action -> Process on the fly to complete info -> Emit 'FullInfo' when full info discovered (Races, winner, etc.)
  //        -> Emit 'done' or 'end' or whatever when fully done parsing/processing -> Callback();

  async.parallel(
  {
    details: function(callback) {
      fs.readFile(detailsFile, function onDetailsRead(err, data) { detailsParser.parse(err, data, version, callback); });
    },
    attributes: function(callback) {
      fs.readFile(attributesFile, function onAttributesRead(err, data) { attributesParser.parse(err, data, version, callback); });
    },
    messages: function(callback) {
      fs.readFile(messagesFile, function onMessagesRead(err, data) { messagesParser.parse(err, data, version, callback); });
    }
  },
  function(err, results) {
    if(err) {
      callback(err);
      return;
    }

    comsat_util.rm_rf(extractDir, function(err) { if(err) console.log("Error deleting extracted replay directory: " + err); });

    results.header = header;
    self._mergeData(results, callback);
  });
}


function Info() {
  this.version = null;
  this.region = null;
  this.gameLength = null;
  this.date = null;
  this.format = null;
  this.speed = null;
  this.numPlayers = null;
  this.teams = null;
  this.gameType = null;
  this.recordedBy = null;
}

Info.prototype = {
  gameLengthInSeconds: function() {
    return framesToSeconds(this.gameLength, this.speed);
  }
}

function Player(name) {
  this.name = name;
  this.bnetId = null;
  this.race = null;
  this.color = null;
  this.team = null;
  this.handicap = null;
  this.outcome = null;
  this.playerType = null;
  this.difficulty = null;
}

Player.prototype = {
  isWinner: function() {
    return this.outcome === 1;
  },

  isLoser: function() {
    return this.outcome === 2;
  },

  hasKnownOutcome: function() {
    return this.outcome != 0;
  }
}

function Map() {
  this.name = null;
  this.minimapFilename = null;
  this.hashes = null;
  this.description = null;
  this.author = null;
}

function ChatMessage(player, channel, timestamp, message) {
  this.player = player;
  this.channel = channel;
  this.timestamp = timestamp;
  this.message = message;
}

ChatMessage.prototype = {
  timestampInSeconds: function(gameSpeed) {
    return framesToSeconds(this.timestamp, gameSpeed);
  },
  channelToString: function() {
    switch(this.channel) {
      case 0: return 'All';
      case 1: return 'Channel #1';
      case 2: return 'Allies';
      case 3: return 'Channel #3';
    }
  }
}

module.exports = {
  loadReplay: function(filename, deleteFile, callback) {
    var rep = new Replay(filename);
    rep.load(deleteFile, function(err) {
      callback(err, rep);
    });
    return rep;
  },

  Replay: Replay,
  Info: Info,
  Player: Player,
  Map: Map,

  parsers: {
    header: headerParser,
    details: detailsParser,
    attributes: attributesParser,
    messages: messagesParser,
    gameEvents: null
  }
}

function framesToSeconds(frames, gameSpeed) {
  var framesPerSecond = 16;
    switch(gameSpeed) { // thanks for the conversions liquipedia! :D
      case 'Faster': framesPerSecond = 22.06897; break;
      case 'Fast': framesPerSecond = 19.33534; break;
      case 'Slow': framesPerSecond = 12.8; break;
      case 'Slower': framesPerSecond = 9.63855; break;
    }

    return Math.round(frames / framesPerSecond);
}
