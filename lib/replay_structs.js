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

module.exports = {
  Info: Info,
  Player: Player,
  Map: Map,
  ChatMessage: ChatMessage
}
