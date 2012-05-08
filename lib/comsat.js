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
};

Replay.prototype._processHeader = function(data) {
  console.time('Replay#_processHeader');
  this.info = new replayStructs.Info();

  var hVersion = data.version;
  this.info.version = {
    major: hVersion.major,
    minor: hVersion.minor,
    patch: hVersion.patch,
    build: hVersion.build
  };
  this.info.gameLength = data.gameLength;
  console.timeEnd('Replay#_processHeader');
  console.log('Replay Version: %d.%d.%d Build %d', hVersion.major, hVersion.minor, hVersion.patch, hVersion.build);
};

Replay.prototype._processDetails = function(details) {
  console.time('Replay#_processDetails');
  for(var i = 0; i < details.players.length; i++) {
    var detailPlayer = details.players[i];
    var newPlayer = this.players[i] = this.players[i] ||
                                      new replayStructs.Player();

    newPlayer.name = detailPlayer.name;
    newPlayer.bnetId = detailPlayer.idInfo.realId;
    newPlayer.color = newPlayer.color || { };
    newPlayer.color.argb = detailPlayer.color;
    newPlayer.handicap = detailPlayer.handicap;
    newPlayer.outcome = detailPlayer.outcome;
    newPlayer.isObs = false;
    // TODO: we can pull actual race for random players from replay.details,
    // but the text is localized. Either build a conversion function or pull
    // this data from game events
  }

  this.info.region = details.mapFiles[0].region.toUpperCase();
  // converts from Windows nano time to unix time
  // (so we don't have to deal with bigints outside of this module)
  var unixDate = details.datetime.
                  subtract(new BigInteger('116444735995904000')).
                  divide(BigInteger.valueOf(10).pow(7)).
                  intValue();
  var timezoneOffsetSec = details.timezoneOffset.
                          divide(BigInteger.valueOf(10).pow(7)).intValue();
  this.info.date = { value: unixDate, timezoneOffset: timezoneOffsetSec };
  this.info.numPlayers = details.players.length;
  console.timeEnd('Replay#_processDetails');
};

Replay.prototype._processAttributes = function(attributes) {
  console.time('Replay#_processAttributes');
  var attrNames = attributesParser.attributeNames;
  var i, attrib;

  if(attributes[attrNames.PlayerType]) {
    attrib = attributes[attrNames.PlayerType];
    // remap players array using this info, since it doesn't take 
    //  into account open slots
    if(this.players.length > 0) {
      var newPlayerArray = [ ];
      for(i = 0, playerIdx = 0; i < attrib.length; i++) {
        if(attrib[i] == 'Open') continue;
        newPlayerArray[i] = this.players[playerIdx++] ||
                            new replayStructs.Player();
      }
      this.players = newPlayerArray;
    }

    for(i = 0; i < attrib.length; i++) {
      var type = attributesParser.playerType(attrib[i]);
      if(type != 'Open') {
        var player = this.players[i] = this.players[i] ||
                                        new replayStructs.Player();
        player.playerType = type;

        if(attributes[attrNames.PlayerRace] &&
                      attributes[attrNames.PlayerRace][i]) {
          player.race = attributesParser.playerRace(
                          attributes[attrNames.PlayerRace][i]
                        );
        }
        if(attributes[attrNames.PlayerColor] &&
                      attributes[attrNames.PlayerColor][i]) {
          player.color = player.color || {};
          player.color.name = attributesParser.playerColor(
                                attributes[attrNames.PlayerColor][i]
                              );
        }

        if(attributes[attrNames.Difficulty] &&
                      attributes[attrNames.Difficulty][i]) {
          player.difficulty = attributesParser.difficulty(
                                attributes[attrNames.Difficulty][i]
                              );
        }
      }
    }
  }
  var teamAttrib = null;
  if(attributes[attrNames.Format]) {
    this.info.format = attributesParser.format(
                        attributes[attrNames.Format][15]
                      );
    if(this.info.format !== 'Custom') teamAttrib = 'Teams' + this.info.format;
  }

  if(attributes[attrNames.GameSpeed]) {
    this.info.speed = attributesParser.gameSpeed(
                        attributes[attrNames.GameSpeed][15]
                      );
  }

  if(attributes[attrNames.GameType]) {
    this.info.gameType = attributesParser.gameType(
                          attributes[attrNames.GameType][15]
                        );
  }

  if(teamAttrib && attributes[attrNames[teamAttrib]]) {
    attrib = attributes[attrNames[teamAttrib]];
    this.info.teams = this.info.teams || [];
    var winningTeam = -1;
    for(i = 0; i < attrib.length; i++) {
      var teamNum = (attrib[i].split('T')[1] * 1) - 1;
      this.players[i].team = teamNum;
      this.info.teams[teamNum] = this.info.teams[teamNum] || [];
      this.info.teams[teamNum].push(this.players[i]);

      if(this.players[i].isWinner()) winningTeam = teamNum;
    }

    if(winningTeam > -1) {
      for(i = 0; i < this.players.length; i++) {
        if(this.players[i] && this.players[i].team === winningTeam)
          this.players[i].outcome = 1;
        else if(this.players[i])
          this.players[i].outcome = 2;
      }
    }
  }
  console.timeEnd('Replay#_processAttributes');
};

Replay.prototype._processChat = function(messages) {
  console.time('Replay#_processChat');
  for(var i = 0; i < messages.length; i++) {
    var event = messages[i];
    if(event.flags == 0x83) {
      // TODO: is this a map ping? FIND OUT MOFO
      // yes: [ 4 byte int = x] [ 4 byte int = y]
      // bytes in little endian, reverse. 
      // and need to be shifted down 1 bit afterwards (same as blizzerial)
      // To convert to normalized X/Y divide by 65536
      continue;
    }
    else if(event.flags == 0x80) {
      // only sent by players other than the recorder,
      //mark them as not the recorder
      this._notRecorder[event.playerId-1] = true;
      continue;
    }
    else {
      // actual, real live chat message!
      var chatMessage = new replayStructs.ChatMessage(
                          this.players[event.playerId-1],
                          event.payload.channel,
                          event.frame,
                          event.payload.message
                        );
      this.messages.push(chatMessage);
    }
  }

  console.timeEnd('Replay#_processChat');
};

Replay.prototype._finishChat = function() {
  var possibleRecorders = this.players.filter(function(player, index) {
    return !this._notRecorder[index] && (player.playerType != 'Computer');
  }, this);
  if(possibleRecorders.length === 1)
    this.info.recordedBy = possibleRecorders[0];
};

Replay.prototype._processActions = function(actions) {
  console.time('Replay#_processActions');
  console.timeEnd('Replay#_processActions');
};

Replay.prototype._finishActions = function() {

};

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
  this._notRecorder = [];

  console.time('Replay PARTIAL');
  console.time('Replay DONE');
  // TODO: add events for chat and actions that emit directly from Replay's
  //  emitter
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
        console.timeEnd('Replay PARTIAL');
        self.emit('partial');
      }
    })
    .on('attributes', function(data) {
      console.log('ReplayParser => "attributes"');
      self._processAttributes(data);

      done.attributes = true;
      if(!done.partial && done.header && done.details && done.attributes) {
        done.partial = true;
        console.timeEnd('Replay PARTIAL');
        self.emit('partial');
      }
    })
    .on('chat', function(data) {
      console.log('ReplayParser => "chat"');
      self._processChat(data);
    })
    .on('chatDone', function() {
      console.log('ReplayParser => "chatDone"');
      self._finishChat();
      done.chat = true;
    })
    .on('actions', function(data) {
      console.log('ReplayParser => "actions"');
      self._processActions(data);
      self.emit('actions', data); // TODO: I'm sure this is not what I want to do here in actuality
    })
    .on('actionsDone', function() {
      console.log('ReplayParser => "actionsDone"');
      self._finishActions();
      done.actions = true;
    })
    .on('done', function() {
      console.log('ReplayParser => "done"');

      this.loaded = true;
      console.timeEnd('Replay DONE');
      self.emit('done');
      callback();
    });

  return this;
};

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
};
