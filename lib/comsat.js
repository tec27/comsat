var fs = require('fs')
  , path = require('path')
  , async = require('async')
  , bigint = require('bigint')
  , mpyq = require('./mpyq')
  , comsat_util = require('./comsat_util')
  , headerParser = require('./parsers/header')
  , detailsParser = require('./parsers/details')
  , attributesParser = require('./parsers/attributes')

function Replay(filename) {
  this.filename = filename;
  this._loaded = false;
}

Replay.prototype = {
  _mergeData: function(data, callback) {
    if(!data.header && !data.detail) { // TODO: add the rest of the data files to this list
      callback(new Error('No replay data files could be read!'));
      return;
    }

    this.info = new Info();
    this.players = [];
    this.map = new Map();
    this.messages = [];
    this.actions = [];

    if(data.header) {
      var hVersion = data.header.version;
      this.info.version = { major: hVersion.major, minor: hVersion.minor, patch: hVersion.patch, build: hVersion.build };
      this.info.gameLength = data.header.game_length;
    }

    if(data.details) {
      for(var i = 0; i < data.details.players.length; i++) {
        var detailPlayer = data.details.players[i];
        var newPlayer = this.players[i] = this.players[i] || new Player();
        newPlayer.name = detailPlayer.name;
        newPlayer.bnetId = detailPlayer.idInfo.realId;
        newPlayer.race = detailPlayer.race; // TODO: this would be better to come from initialization events, this value is localized
        newPlayer.color = newPlayer.color || { };
        newPlayer.color.argb = detailPlayer.color;
        // newPlayer.team = detailPlayer.team; teams from replay detail are not actually correct
        newPlayer.handicap = detailPlayer.handicap;
        newPlayer.outcome = detailPlayer.outcome;

        /* teams from detail are not correct, DO NOT USE
        if(newPlayer.team) {
          console.log(newPlayer.name + ' is on team ' + newPlayer.team + " (detail: " + detailPlayer.team);
          this.info.teams = this.info.teams || [];
          this.info.teams[newPlayer.team] = this.info.teams[newPlayer.team] || [];
          this.info.teams[newPlayer.team].push(newPlayer);
        }*/
      }

      this.info.region = data.details.mapFiles[0].region.toUpperCase();
      var unixDate = data.details.datetime.sub(bigint('116444735995904000')).div(bigint(10).pow(7)).toNumber(); // converts from Windows nano time to unix time (so we don't have to deal with bigints outside of this module)
      var timezoneOffsetSec = data.details.timezoneOffset.div(bigint(10).pow(7)).toNumber();
      this.info.date = { value: unixDate, timezoneOffset: timezoneOffsetSec };
    }

    this._loaded = true;
    callback();
  },

  load: function(deleteFile, callback) {
    // vars to access things on 'this' inside of callbacks
    (function(replay) {
      mpyq.extractReplay(replay.filename, deleteFile, function(err,extractDir) {
        if(err) 
        {
          callback(err);
          return;
        }

        var headerFile = path.join(extractDir, 'replay.header');
        var detailsFile = path.join(extractDir, 'replay.details');

        async.parallel(
        {
          header: function(callback) {
            fs.readFile(headerFile, function(err, data) { headerParser.parse(err, data, callback); });
          },
          details: function(callback) {
            fs.readFile(detailsFile, function(err, data) { detailsParser.parse(err, data, callback); });
          },
        },
        function(err, results) {
          if(err) {
            console.log("Error when parsing replay files: " + err);
            return;
          }
          if(deleteFile)
            comsat_util.rm_rf(extractDir, function(err) { if(err) console.log("Error deleting extracted replay directory: " + err); });

          replay._mergeData(results, callback);
        });
      });
    })(this);
  }
}


function Info() {
  this.version = null;
  this.region = null;
  this.gameLength = null;
  this.date = null;
  this.format = null;
  this.speed = null;
  this.teams = null;
  this.gameType = null;
  this.recordedBy = null;
}

Info.prototype = {
  gameLengthInSeconds: function() {
    var framesPerSecond = 16;
    switch(this.speed) { // thanks for the conversions liquipedia! :D
      case 'Faster': framesPerSecond = 22.06897; break;
      case 'Fast': framesPerSecond = 19.33534; break;
      case 'Slow': framesPerSecond = 12.8; break;
      case 'Slower': framesPerSecond = 9.63855; break;
    }

    return Math.round(this.gameLength / framesPerSecond);
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

module.exports = {
  loadReplay: function(filename, deleteFile, callback) {
    var rep = new Replay(filename);
    rep.load(deleteFile, function(err) {
      callback(err, rep);
    });
  },

  Replay: Replay,
  Info: Info,
  Player: Player,
  Map: Map,

  parsers: {
    header: headerParser,
    details: detailsParser,
    attributes: attributesParser,
    messages: null, // TODO
    gameEvents: null
  }
}
