var EventEmitter = require('events').EventEmitter,
    Buffers = require('buffers');

var parseActions = module.exports.parse = function parseGameEvents(stream, version) {
  var emitter = new EventEmitter();

  new ActionsReader(stream, version, emitter);

  return emitter;
}

function ActionsReader(stream, version, emitter) {
  this.stream = stream;
  this.version = version;
  this.emitter = emitter;

  this.buffers = Buffers();
  this.actionParser = this._getActionParser(version);

  this._setupStreamReader();
}

ActionsReader.prototype._setupStreamReader = function() {
  var self = this;
  this.stream
    .on('data', function(data) {
      if(self.error) return;
      self.buffers.push(data);
      try{
        self._onData();
      }
      catch(err) {
        self._error(err);
      }
    })
    .on('error', function(err) {
      self._error(err);
    })
    .on('end', function() {
      if(!self.error && !self.buffers.toBuffer().length) self.emitter.emit('success');
      else self._error('error', new Error('Leftover data in game actions buffer'));
    });
}

ActionsReader.prototype._getActionParser = function(version) {
  var i = 0;
  while(parserVersions[i] && parserVersions[i].minBuild <= version.build) i++;
  return new parserVersions[--i].parser;
}

ActionsReader.prototype._error = function(err) {
  if(this.error) return;

  this.error = err;
  this.emitter.emit('error', err);
}

ActionsReader.prototype._onData = function() {
  var data = this.buffers.toBuffer();
  var idx = 0;
  var actions = [ ];
  var currentFrame = 0;

  var eventHeaderRet;
  while(eventHeaderRet = this._parseEventHeader(data, idx)) {
    idx += eventHeaderRet.size;
    var eventHeader = eventHeaderRet.value;
    currentFrame += eventHeader.frameDelta;
    delete eventHeader.frameDelta;
    eventHeader.frame = currentFrame;

    var action = this.actionParser.parse(eventHeader, data, idx);
  }
}

ActionsReader.prototype._parseEventHeader = function(data, idx) {
  var initIdx = idx;
  var value = { };

  var timestampRet = this._parseTimestamp(data, idx);
  if(!timestampRet) return false;
  value.frameDelta = timestampRet.value;
  idx += timestampRet.size;

  if(idx >= data.length + 2) return false;
  var typeAndPlayer = data[idx++];
  value.player = typeAndPlayer & 31; // right 5 bits
  value.type = typeAndPlayer >> 5; // left 3 bits;

  value.code = data[idx++];

  return { value: value, size: (idx - initIdx) };
}

ActionsReader.prototype._parseTimestamp = function(data, idx) {
  if(idx >= data.length) return false;
  var size = (data[idx] & 3) + 1;
  if(data.length < size) return false;
  var value = data[idx] >>> 2;
  for(var i = 1;  i < size; i++)
    value = (value << 8) + data[idx+i];

  return {value: value, size: size};
}

function ActionParser() {

}

ActionParser.prototype.parse = function(eventHeader, data, idx) {
  switch(eventHeader.type) {
    case 0x00: return this.initialization(eventHeader, data, idx);
    case 0x01: return this.playerActions(eventHeader, data, idx);
    case 0x02: return this.gameState(eventHeader, data, idx);
    case 0x03: return this.cameraMovement(eventHeader, data, idx);
    case 0x04: return this.unknown4(eventHeader, data, idx); // resource requests, etc.
    case 0x05: return this.system(eventHeader, data, idx);
  }

  throw new Error('Unknown event type: ' + eventHeader.type);
}

ActionParser.prototype.initialization = function(eventHeader, data, idx) {
  switch(eventHeader.code) {
    case 0x0B:
    case 0x0C:
    case 0x2B: // TODO: I think 2B is the same event, could be wrong
    case 0x2C: return this.joinEvent(eventHeader, data, idx);

    case 0x05: return this.startEvent(eventHeader, data, idx);

    default: throw new Error('Unknown Initialization event code: '  + eventHeader.code);
  }
}

ActionParser.prototype.playerActions = function(eventHeader, data, idx) {
  var hi = (eventHeader.code & 0xF0) >>> 4,
      lo = (eventHeader.code & 0x0F);
  
  if(lo == 0xB)
    return this.useAbility(eventHeader, data, idx);
  if(lo == 0xC && hi <= 0xA)
    return this.selectAction(eventHeader, data, idx);
  if(lo == 0xD && hi <= 0x9)
    return this.hotkeyAction(eventHeader, data, idx);
  if(lo == 0xF && hi <= 0x8)
    return this.resourceTransfer(eventHeader, data, idx);
  if(lo == 0x9 && hi == 0x0)
    return this.leaveGame(eventHeader, data, idx);

  throw new Error('Unknown Player Action event code: ' + eventHeader.code);
}

ActionParser.prototype.gameState = function(eventHeader, data, idx) {
  switch(eventHeader.code) {
    case 0x06: return this.allianceChange(eventHeader, data, idx);
    case 0x73: return this.decreaseGameSpeed(eventHeader, data, idx);
    case 0x83: return this.increaseGameSpeed(eventHeader, data, idx);

    case 0x07: return this.unknownGS07(eventHeader, data, idx); // unknown, take off 4 bytes
    case 0x0E: return this.unknownGS0E(eventHeader, data, idx); // unknown, take off 4 bytes
    case 0x8F: return this.unknownGS8F(eventHeader, data, idx); // unknown, take off 4 bytes
    default: throw new Error('Unknown Game State event code: ' + eventHeader.code);
  }
}

ActionParser.prototype.cameraMovement = function(eventHeader, data, idx) {
  if((eventHeader.code & 0x0F) == 0x1)
    return this.moveScreen(eventHeader, data, idx);

  switch(eventHeader.code) {
    case 0x08: return this.unknownCM08(eventHeader, data, idx);
    case 0x18: return this.unknownCM18(eventHeader, data, idx);
    case 0x80: return this.unknownCM80(eventHeader, data, idx);
    case 0x87: return this.unknownCM87(eventHeader, data, idx);
    case 0x88: return this.unknownCM88(eventHeader, data, idx);
    default: throw new Error('Unknown Camera Movement event code: ' + eventHeader.code);
  }
}

ActionParser.prototype.unknown4 = function(eventHeader, data, idx) {
  var hi = (eventHeader.code & 0xF0) >>> 4,
      lo = (eventHeader.code & 0x0F);

  if(lo == 0x8 && hi >= 1 && hi <= 0x8)
    return this.cancelResourceRequest(eventHeader, data, idx);
  if(lo == 0xC)
    return this.unknownUKXC(eventHeader, data, idx);

  switch(eventHeader.code) {
    case 0x00: return this.unknownUK00(eventHeader, data, idx);
    case 0x82: return this.unknownUK82(eventHeader, data, idx);
    case 0x87: return this.unknownUK87(eventHeader, data, idx);
    case 0xC6: return this.sendResourceRequest(eventHeader, data, idx);
  }

  throw new Error('Unknown Unknown4 event code: ' + eventHeader.code);
}

ActionParser.prototype.system = function(eventHeader, data, idx) {
  if(eventHeader.code == 0x89)
    return this.unknownSY89(eventHeader, data, idx);

  throw new Error('Unknown System event code: ' + eventHeader.code);
}

//-----Initialization v0-----//
ActionParser.prototype.joinEvent = function(eventHeader, data, idx) {
  console.log('[%d] Player Joined: %d', eventHeader.frame, eventHeader.player);
}

ActionParser.prototype.startEvent = function(eventHeader, data, idx) {
  console.log('[%d] Game Started.', eventHeader.frame);
}

//-----Player Actions v0-----//
ActionParser.prototype.selectAction = function(eventHeader, data, idx) {
  // TODO
}

ActionParser.prototype.useAbility = function(eventHeader, data, idx) {
  // TODO
}

ActionParser.prototype.hotkeyAction = function(eventHeader, data, idx) {
  // TODO
}

ActionParser.prototype.resourceTransfer = function(eventHeader, data, idx) {
  // TODO
}

ActionParser.prototype.leaveGame = function(eventHeader, data, idx) {
  // TODO
}

//-----Game State v0-----//
ActionParser.prototype.allianceChange = function(eventHeader, data, idx) {
  // TODO
}

ActionParser.prototype.decreaseGameSpeed = function(eventHeader, data, idx) {
  // TODO
}

ActionParser.prototype.increaseGameSpeed = function(eventHeader, data, idx) {
  // TODO
}

ActionParser.prototype.unknownGS07 = function(eventHeader, data, idx) {
  // TODO - remove 4 bytes
}

ActionParser.prototype.unknownGS0E = function(eventHeader, data, idx) {
  // TODO - remove 4 bytes
}

ActionParser.prototype.unknownGS8F = function(eventHeader, data, idx) {
  // TODO: - remove 4 bytes
}

//-----Camera Movement v0-----//
ActionParser.prototype.moveScreen = function(eventHeader, data, idx) {
  // TODO
}

ActionParser.prototype.unknownCM08 = function(eventHeader, data, idx) {
  // TODO: read big-endian short, skip (short & 0x0F) << 3 bytes
}

ActionParser.prototype.unknownCM18 = function(eventHeader, data, idx) {
  // TODO: skip 162 or 250 bytes (not sure which, discrepencies abound), I trust 250 more
}

ActionParser.prototype.unknownCM80 = function(eventHeader, data, idx) {
  // TODO: skip 4 bytes
}

ActionParser.prototype.unknownCM87 = function(eventHeader, data, idx) {
  // TODO: skip 8 bytes
}

ActionParser.prototype.unknownCM88 = function(eventHeader, data, idx) {
  // TODO: skip 514 bytes
}

//-----Unknown4 v0-----//
ActionParser.prototype.cancelResourceRequest = function(eventHeader, data, idx) {
  // TODO: this seems to read 4 bytes off, not sure what they're for
}

ActionParser.prototype.sendResourceRequest = function(eventHeader, dta, idx) {
  // TODO
}

ActionParser.prototype.unknownUKXC = function(eventHeader, data, idx) {
  // TODO: doesn't seem to read any data, no idea what this event is for
}

ActionParser.prototype.unknownUK00 = function(eventHeader, data, idx) {
  // TODO: read 4 bytes
}

ActionParser.prototype.unknownUK82 = function(eventHeader, data, idx) {
  // TODO: read 2 bytes
}

ActionParser.prototype.unknownUK87 = function(eventHeader, data, idx) {
  // TODO: read 4 bytes
}

//-----System v0-----//
ActionParser.prototype.unknownSY89 = function(eventHeader, data, idx) {
  // TODO: read 4 bytes
  // 89 best year! Blizzard knows!
}

var parserVersions = [
  {minBuild: 0, parser: ActionParser} // TODO: fill this out as more parser versions get added
]

// Plan for Parsers:
//  - make one for each event code thing (join event, start event, ability event, selection event, etc.)
//  - make a base class for the initial version with all of the functions for parsing these (leave functions blank if such an event didn't exist then)
//  - inherit from that class and override things in prototype that changed
//  - pick the right version at start of module.parse() and use it
//  - gg
//  - re?
