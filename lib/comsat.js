var EventEmitter = require('events').EventEmitter,
    path = require('path'),
    util = require('util'),
    BigInteger = require('bigdecimal').BigInteger,
    replayStructs = require('./replay_structs'),
    ReplayParser = require('./parsers/replay_parser').ReplayParser,
    attributesParser = require('./parsers/attributes');

function Replay(filename) {
  this.filename = filename;
  this._loaded = false;
  this.error = null;

  EventEmitter.call(this);
}
util.inherits(Replay, EventEmitter);

Replay.prototype._error = function(err, callback) {
  if(this.error) return;

  this.error = err;
  this.emit('error', err);
  if(callback) callback(err);
}

Replay.prototype._processHeader = function(data) {
  this.info = new replayStructs.Info();

  var hVersion = data.version;
  this.info.version = { major: hVersion.major, minor: hVersion.minor, patch: hVersion.patch, build: hVersion.build };
  this.info.gameLength = data.game_length;
}

Replay.prototype._processDetails = function(details) {
  for(var i = 0; i < details.players.length; i++) {
    var detailPlayer = details.players[i];
    var newPlayer = this.players[i] = this.players[i] || new replayStructs.Player();
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
        newPlayerArray[i] = this.players[playerIdx++] || new replayStructs.Player();
      }
      this.players = newPlayerArray;
    }

    for(var i = 0; i < attrib.length; i++) {
      var type = attributesParser.playerType(attrib[i]);
      if(type != 'Open') {
        var player = this.players[i] = this.players[i] || new replayStructs.Player();
        player.playerType = type;

        if(attributes[attrNames.PlayerRace] && attributes[attrNames.PlayerRace][i])
          player.race = attributesParser.playerRace(attributes[attrNames.PlayerRace][i]);

        if(attributes[attrNames.PlayerColor] && attributes[attrNames.PlayerColor][i]) {
          player.color = player.color || {};
          player.color.name = attributesParser.playerColor(attributes[attrNames.PlayerColor][i]);
        }

        if(attributes[attrNames.Difficulty] && attributes[attrNames.Difficulty][i])
          player.difficulty = attributesParser.difficulty(attributes[attrNames.Difficulty][i]);
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

Replay.prototype._processChat = function(messages) { // TODO: find a way to process the 'notRecorder' chat events in stream and still come to the right outcome
  var notRecorder = [ ];
  for(var i = 0; i < messages.length; i++) {
    var event = messages[i];
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
      var chatMessage = new replayStructs.ChatMessage(this.players[event.playerId-1], event.payload.channel, event.frame, event.payload.message);
      this.messages.push(chatMessage);
    }
  }

  var possibleRecorders = [ ];
  for(var i = 0; i < this.players.length; i++) {
    if(!notRecorder[i]) possibleRecorders.push(this.players[i]);
  }
  if(possibleRecorders.length === 1) this.info.recordedBy = possibleRecorders[0];
}

Replay.prototype._processActions = function(actions) {
}

Replay.prototype.load = function(deleteFile, callback) {
  var self = this;

  callback = callback || function() {};

  var done = {
    header: false,
    details: false,
    attributes: false,
    partial: false,
    chat: false,
    actions: false
  };

  this.players = [];
  this.map = new replayStructs.Map();
  this.messages = [];
  this.actions = [];

  // TODO: add events for chat and actions that emit directly from Replay's emitter
  ReplayParser(this.filename, deleteFile).parse()
    .on('error', function(err) {
      console.log('ReplayParser => "error": ' + err);
      self._error(err, callback);
    })
    .on('header', function(data) {
      console.log('ReplayParser => "header"');
      self._processHeader(data);

      done.header = true;
    })
    .on('details', function(data) {
      console.log('ReplayParser => "details"');
      self._processDetails(data);

      done.details = true;
      if(!done.partial && done.header && done.details && done.attributes) {
        done.partial = true;
        self.emit('partial');
      }
    })
    .on('attributes', function(data) {
      console.log('ReplayParser => "attributes"');
      self._processAttributes(data);

      done.attributes = true;
      if(!done.partial && done.header && done.details && done.attributes) {
        done.partial = true;
        self.emit('partial');
      }
    })
    .on('chat', function(data) { // TODO: this will probably fire once for each output of chat messages, and then we'll get a 'chatdone' event when those are through. same for actions
      console.log('ReplayParser => "chat"');
      self._processChat(data);

      done.chat = true;
    })
    .on('actions', function(data) {
      console.log('ReplayParser => "actions"');
      self._processActions(data);

      done.actions = true;
    })
    .on('done', function() {
      console.log('ReplayParser => "done"');

      this.loaded = true;
      self.emit('done');
      callback();
    });

  return this;
}

module.exports = {
  loadReplay: function(filename, deleteFile, callback) {
    var rep = new Replay(filename);
    rep.load(deleteFile, function(err) {
      callback(err, rep);
    });
    return rep;
  },

  Replay: replayStructs.Replay,
  Info: replayStructs.Info,
  Player: replayStructs.Player,
  Map: replayStructs.Map,
  ChatMessage: replayStructs.ChatMessage,

  ReplayParser: ReplayParser
}
