var EventEmitter = require('events').EventEmitter,
    Buffers = require('buffers'),
    Cursorize = require('./cursorize'),
    Nibbler = require('./nibbler'),
    gameEvents = require('../game_events'),
    util = require('util');

module.exports.parse = function parseGameEvents(stream, version) {
  var emitter = new EventEmitter();

  new ActionsReader(stream, version, emitter);

  return emitter;
};

function ActionsReader(stream, version, emitter) {
  this.stream = stream;
  this.version = version;
  this.emitter = emitter;
  this.lastFrame = 0;

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
      else self._error('Leftover data in game actions buffer');
    });
};

ActionsReader.prototype._getActionParser = function(version) {
  var i = 0;
  while(parserVersions[i] && parserVersions[i].minBuild <= version.build)
    i++;
  return new parserVersions[--i].parser();
};

ActionsReader.prototype._error = function(err) {
  if(this.error) return;

  this.error = err;
  this.emitter.emit('error', err);
};

ActionsReader.prototype._onData = function() {
  var curs = new Cursorize(this.buffers.toBuffer());
  var idx = 0;
  var actions = [ ];
  var currentFrame = this.lastFrame;

  var eventHeader;
  try {
    while(curs.left()) {
      eventHeader = this._parseEventHeader(curs);
      currentFrame += eventHeader.frameDelta;
      delete eventHeader.frameDelta;
      eventHeader.frame = currentFrame;

      //console.log(util.inspect(eventHeader, false, null, true));

      var action = this.actionParser.parse(eventHeader, curs);

      curs.commit();
      actions.push(action);
      this.lastFrame = currentFrame;
      //console.log(util.inspect(action, false, null, true));
    }
  }
  catch(e) {
    if(!(e instanceof Cursorize.NotEnoughData)) { // NotEnoughData is expected, we can use it to break out of the loop
      if(actions.length) this.emitter.emit('actions', actions); // emit actions even on errors to help debugging
      throw e;
    }
  }

  curs.rollback(); // rollback any reads that didn't finish to a complete action
  this.buffers = Buffers();
  if(curs.left()) this.buffers.push(curs.buffer.slice(curs.pos));

  if(actions.length) this.emitter.emit('actions', actions);
};

ActionsReader.prototype._parseEventHeader = function(curs) {
  var value = { };

  value.frameDelta = this._parseTimestamp(curs);

  var typeAndPlayer = curs.read()[0];
  value.player = typeAndPlayer & 31; // right 5 bits
  value.type = typeAndPlayer >> 5; // left 3 bits;

  value.code = curs.read()[0];

  return value;
};

ActionsReader.prototype._parseTimestamp = function(curs) {
  var firstByte = curs.read()[0];
  var size = (firstByte & 3) + 1;
  var value = firstByte >>> 2;
  if(size == 1) return value;
  var nextBytes = curs.read(size-1);
  for(var i = 0;  i < nextBytes.length; i++)
    value = (value << 8) + nextBytes[i];

  return value;
};

function ActionParser() {

}

ActionParser.prototype.parse = function(eventHeader, curs) {
  switch(eventHeader.type) {
    case 0x00: return this.initialization(eventHeader, curs);
    case 0x01: return this.playerActions(eventHeader, curs);
    case 0x02: return this.gameState(eventHeader, curs);
    case 0x03: return this.cameraMovement(eventHeader, curs);
    // resource requests, etc.
    case 0x04: return this.unknown4(eventHeader, curs);
    case 0x05: return this.system(eventHeader, curs);
  }

  throw new Error('Unknown event type: ' + eventHeader.type);
};

ActionParser.prototype.initialization = function(eventHeader, curs) {
  switch(eventHeader.code) {
    case 0x0B:
    case 0x0C:
    case 0x2B: // TODO: I think 2B is the same event, could be wrong
    case 0x2C: return this.joinEvent(eventHeader, curs);

    case 0x05: return this.startEvent(eventHeader, curs);

    default: throw new Error('Unknown Initialization event code: ' +
                               eventHeader.code);
  }
};

ActionParser.prototype.playerActions = function(eventHeader, curs) {
  var hi = (eventHeader.code & 0xF0) >>> 4,
      lo = (eventHeader.code & 0x0F);

  if(lo === 0xB)
    return this.useAbility(eventHeader, curs);
  if(lo === 0xC && hi <= 0xA)
    return this.selectAction(eventHeader, curs);
  if(lo === 0xD && hi <= 0x9)
    return this.hotkeyAction(eventHeader, curs);
  if(lo === 0xF && hi <= 0x8)
    return this.resourceTransfer(eventHeader, curs);
  if(lo === 0x9 && hi === 0x0)
    return this.leaveGame(eventHeader, curs);

  throw new Error('Unknown Player Action event code: ' + eventHeader.code);
};

ActionParser.prototype.gameState = function(eventHeader, curs) {
  switch(eventHeader.code) {
    case 0x06: return this.allianceChange(eventHeader, curs);
    case 0x73: return this.decreaseGameSpeed(eventHeader, curs);
    case 0x83: return this.increaseGameSpeed(eventHeader, curs);

    case 0x07: return this.unknownGS07(eventHeader, curs);
    case 0x0E: return this.unknownGS0E(eventHeader, curs);
    case 0x8F: return this.unknownGS8F(eventHeader, curs);
    default: throw new Error('Unknown Game State event code: ' +
                                eventHeader.code);
  }
};

ActionParser.prototype.cameraMovement = function(eventHeader, curs) {
  if((eventHeader.code & 0x0F) == 0x1)
    return this.moveScreen(eventHeader, curs);

  switch(eventHeader.code) {
    case 0x08: return this.unknownCM08(eventHeader, curs);
    case 0x18: return this.unknownCM18(eventHeader, curs);
    case 0x80: return this.unknownCM80(eventHeader, curs);
    case 0x87: return this.unknownCM87(eventHeader, curs);
    case 0x88: return this.unknownCM88(eventHeader, curs);
    default: throw new Error('Unknown Camera Movement event code: ' +
                                eventHeader.code);
  }
};

ActionParser.prototype.unknown4 = function(eventHeader, curs) {
  var hi = (eventHeader.code & 0xF0) >>> 4,
      lo = (eventHeader.code & 0x0F);

  if(lo === 0x8 && hi >= 1 && hi <= 0x8)
    return this.cancelResourceRequest(eventHeader, curs);
  if(lo === 0xC)
    return this.unknownUKXC(eventHeader, curs);

  switch(eventHeader.code) {
    case 0x00: return this.unknownUK00(eventHeader, curs);
    case 0x82: return this.unknownUK82(eventHeader, curs);
    case 0x87: return this.unknownUK87(eventHeader, curs);
    case 0xC6: return this.sendResourceRequest(eventHeader, curs);
  }

  throw new Error('Unknown Unknown4 event code: ' + eventHeader.code);
};

ActionParser.prototype.system = function(eventHeader, curs) {
  if(eventHeader.code === 0x89)
    return this.unknownSY89(eventHeader, curs);

  throw new Error('Unknown System event code: ' + eventHeader.code);
};

//-----Initialization v0-----//
ActionParser.prototype.joinEvent = function(eventHeader, curs) {
  return new gameEvents.JoinEvent(eventHeader);
};

ActionParser.prototype.startEvent = function(eventHeader, curs) {
  return new gameEvents.StartEvent(eventHeader);
};

//-----Player Actions v0-----//
ActionParser.prototype.selectAction = function(eventHeader, curs) {
  var autoSelect = (eventHeader.code !== 0xAC);
  curs.skip(1);
  var numDeselectBits = curs.read()[0];
  var nib = new Nibbler(curs);
  var deselectMap;
  if(numDeselectBits)
    deselectMap = nib.readBits(numDeselectBits);

  var numUnitTypes = nib.readBits(8)[0];
  var unitTypes = [];
  for(var i = 0; i < numUnitTypes; i++) {
    var unitType = nib.readBits(16);
    var hallucState = nib.readBits(8)[0];
    var cnt = nib.readBits(8)[0];
    unitTypes.push({ type: ((unitType[0] << 8) | unitType[1]), hallucState: hallucState, cnt: cnt });
  }
  var numUnitIds = nib.readBits(8)[0];
  var unitIds = [];
  for(var j = 0; j < numUnitIds; j++) {
    var unitIdData = nib.readBits(32);
    var unitId = (unitIdData[0] << 8) | (unitIdData[1]) |
                  (unitIdData[2] << 24) | (unitIdData[3] << 16);
    unitIds.push(unitId);
  }

  // TODO: find a select action with loBits != 0 and make sure this is logically sound
  var toSkip = nib.readToBoundary();
  if(toSkip.length && toSkip[0] > 0) curs.skip(toSkip);

  return new gameEvents.SelectionEvent(eventHeader, autoSelect, deselectMap, unitTypes, unitIds);
};

ActionParser.prototype.useAbility = function(eventHeader, curs) {
  curs.skip(4);
  var bytes = curs.read(3);
  var abilityCode = bytes[0] << 16 | bytes[1] << 8 | bytes[2];
  var evtSwitch = curs.read()[0];
  if(evtSwitch === 0x30 || evtSwitch === 0x50) curs.skip();
  curs.skip(24);

  return new gameEvents.AbilityEvent(eventHeader, abilityCode);
  // TODO: Come back to this. These are parseable in the earliest version, just don't want to do it atm
  // because I'm lazy :D
};

ActionParser.prototype.hotkeyAction = function(eventHeader, curs) {
  var nib = new Nibbler(curs);
  var action = nib.readBits(2)[0];
  var read = nib.readBits(1)[0];
  var mask;

  if(read) {
    mask = nib.readBits(nib.readBits(8)[0]);
  }

  switch(action) {
    case 0: return new gameEvents.SetHotkeyEvent(eventHeader, mask);
    case 1: return new gameEvents.AddToHotkeyEvent(eventHeader, mask);
    case 2: return new gameEvents.GetHotkeyEvent(eventHeader, mask);
  }
};

ActionParser.prototype.resourceTransfer = function(eventHeader, curs) {
  var targetPlayer = (eventHeader.code & 0xF0) >> 4;
  curs.skip(1);

  var data = curs.read(4);
  var base = (data[0] << 16) | (data[1] << 8) | (data[2]);
  var multiplier = (data[3] & 0xF0) >> 4;
  var extra = data[3] & 0x0F;
  var minerals = (base * multiplier) + extra;

  data = curs.read(4);
  base = (data[0] << 16) | (data[1] << 8) | (data[2]);
  multiplier = (data[3] & 0xF0) >> 4;
  extra = data[3] & 0x0F;
  var gas = (base * multiplier) + extra;

  curs.skip(8);

  return new gameEvents.ResourceTransferEvent(eventHeader, targetPlayer, minerals, gas);
};

ActionParser.prototype.leaveGame = function(eventHeader, curs) {
  return new gameEvents.LeaveEvent(eventHeader);
};

//-----Game State v0-----//
ActionParser.prototype.allianceChange = function(eventHeader, curs) {
  var ukData = curs.read(8);
  return new gameEvents.AllianceChangeEvent(eventHeader, ukData);
};

ActionParser.prototype.decreaseGameSpeed = function(eventHeader, curs) {
  return new gameEvents.DecreaseGameSpeedEvent(eventHeader, curs.read(1)[0]);
};

ActionParser.prototype.increaseGameSpeed = function(eventHeader, curs) {
  return new gameEvents.IncreaseGameSpeedEvent(eventHeader, curs.read(1)[0]);
};

ActionParser.prototype.unknownGS07 = function(eventHeader, curs) {
  return new gameEvents.UnknownEvent(eventHeader, curs.read(4));
};

ActionParser.prototype.unknownGS0E = function(eventHeader, curs) {
  return new gameEvents.UnknownEvent(eventHeader, curs.read(4));
};

ActionParser.prototype.unknownGS8F = function(eventHeader, curs) {
  return new gameEvents.UnknownEvent(eventHeader, curs.read(4));
};

//-----Camera Movement v0-----//
ActionParser.prototype.moveScreen = function(eventHeader, curs) {
  var zoom = false, rotate = false;
  // calculate flag first so we can break out if there isn't enough data in the buffer:
  var origPos = curs.pos;
  curs.skip(3);
  var flag = (curs.read(1)[0] & 0xF0) >> 4;
  var flags = [ flag ];
  if(flag & 0x1) {
    curs.skip(1);
    flag = curs.read(1)[0] >> 4;
    flags.push(flag);
    zoom = true;
  }
  if(flag & 0x2) {
    curs.skip(1);
    flag = curs.read(1)[0] >> 4;
    flags.push(flag);
    zoom = true;
  }
  if(flag & 0x4) {
    curs.skip(2);
    flags.push(flag);
    rotate = true;
  }

  var finalPos = curs.pos;
  curs.pos = origPos;

  // calculate x/y:
  // picture of the data for clarity :) :
  // XXXXCCCC XXXXxxxx YYYYxxxx YYYYyyyy FFFFyyyy
  //   code       0        1        2       3

  curs.rewind(1); // access the code byte again
  var nib = new Nibbler(curs);
  nib.readBits(4);
  // X/Y are 16-bit bcd's (8 bit whole, 8 bit decimal)
  var xData = nib.readBits(16), yData = nib.readBits(16);
  var x = xData[0] + (xData[1] / 256);
  var y = yData[0] + (yData[1] / 256);
  curs.pos = finalPos;
  var mse = new gameEvents.MoveScreenEvent(eventHeader, x, y, flags, zoom,
                                            rotate);
  return mse;
};

ActionParser.prototype.unknownCM08 = function(eventHeader, curs) {
  // TODO: read big-endian short, skip (short & 0x0F) << 3 bytes
};

ActionParser.prototype.unknownCM18 = function(eventHeader, curs) {
  // TODO: skip 162 or 250 bytes (not sure which, discrepencies abound), I trust 250 more
};

ActionParser.prototype.unknownCM80 = function(eventHeader, curs) {
  curs.skip(4);
};

ActionParser.prototype.unknownCM87 = function(eventHeader, curs) {
  curs.skip(8);
};

ActionParser.prototype.unknownCM88 = function(eventHeader, curs) {
  // TODO: skip 514 bytes
};

//-----Unknown4 v0-----//
ActionParser.prototype.cancelResourceRequest = function(eventHeader, curs) {
  curs.skip(4);

  return new gameEvents.CancelResourceRequestEvent(eventHeader);
};

ActionParser.prototype.sendResourceRequest = function(eventHeader, curs) {
  var data = curs.read(4);
  var minerals = (data[0] << 23) | (data[1] << 15) | (data[2] << 7) | (data[3] & 0x7F);
  data = curs.read(4);
  var gas = (data[0] << 23) | (data[1] << 15) | (data[2] << 7) | (data[3] & 0x7F);

  curs.skip(8);
  return new gameEvents.ResourceRequestEvent(eventHeader, minerals, gas);
};

ActionParser.prototype.unknownUKXC = function(eventHeader, curs) {
  // TODO: doesn't seem to read any data, no idea what this event is for
};

ActionParser.prototype.unknownUK00 = function(eventHeader, curs) {
  // TODO: read 4 bytes
};

ActionParser.prototype.unknownUK82 = function(eventHeader, curs) {
  // TODO: read 2 bytes
};

ActionParser.prototype.unknownUK87 = function(eventHeader, curs) {
  // TODO: read 4 bytes
};

//-----System v0-----//
ActionParser.prototype.unknownSY89 = function(eventHeader, curs) {
  // TODO: read 4 bytes
  // 89 best year! Blizzard knows!
};


function ActionParser16561() {
  ActionParser16561.super_.call(this);
}
util.inherits(ActionParser16561, ActionParser);

ActionParser16561.prototype.selectAction = function(eventHeader, curs) {
  curs.skip(1);

  var nib = new Nibbler(curs);
  var modMode = nib.readBits(2)[0];
  var numDeselectBits, deselectMap, modeData;
  if(modMode === 1) {
    // 1 is deselect by bitmask
    numDeselectBits = nib.readBytes(1)[0];
    if(numDeselectBits)
      deselectMap = nib.readBits(numDeselectBits);
  }
  else if(modMode === 2 || modMode === 3) {
    // 2 is deselect by index, 3 is replace by index
    // TODO: make use of this data
    var cnt = nib.readBytes(1)[0];
    if(cnt > 0) modeData = nib.readBytes(cnt);
  }

  var numUnitTypes = nib.readBytes(1)[0];
  var unitTypes = [];
  for(var i = 0; i < numUnitTypes; i++) {
    var unitType = nib.readBits(16);
    var hallucState = nib.readBits(8)[0];
    var unitCnt = nib.readBits(8)[0];
    unitTypes.push({ type: ((unitType[0] << 8) | unitType[1]), hallucState: hallucState, cnt: unitCnt });
  }
  var numUnitIds = nib.readBits(8)[0];
  var unitIds = [];
  for(var j = 0; j < numUnitIds; j++) {
    var unitIdData = nib.readBits(32);
    var unitId = (unitIdData[0] << 8) | (unitIdData[1]) |
                  (unitIdData[2] << 24) | (unitIdData[3] << 16);
    unitIds.push(unitId);
  }

  return new gameEvents.SelectionEvent(eventHeader, false, deselectMap, unitTypes, unitIds, modMode, modeData);
};

ActionParser16561.prototype.hotkeyAction = function(eventHeader, curs) {
  var nib = new Nibbler(curs),
      action = nib.readBits(2)[0],
      modMode = nib.readBits(2)[0],
      numDeselectBits, deselectMap, modeData;
  if(modMode === 1) {
    // 1 is deselect by bitmask
    numDeselectBits = nib.readBytes(1)[0];
    if(numDeselectBits)
      deselectMap = nib.readBits(numDeselectBits);
  }
  else if(modMode === 2 || modMode === 3) {
    // 2 is deselect by index, 3 is replace by index
    // TODO: make use of this data
    var cnt = nib.readBytes(1)[0];
    if(cnt > 0) modeData = nib.readBytes(cnt);
  }

  // TODO: need to make hotkey events able to take in different modes than mode 1
  switch(action) {
    case 0: return new gameEvents.SetHotkeyEvent(eventHeader, deselectMap);
    case 1: return new gameEvents.AddToHotkeyEvent(eventHeader, deselectMap);
    case 2: return new gameEvents.GetHotkeyEvent(eventHeader, deselectMap);
  }
};

ActionParser16561.prototype.useAbility = function(eventHeader, curs) {
  // TODO: come back to this ability parser as well :)
  var data = curs.read(2),
      flag = data[0],
      abilityType = data[1];

  if(abilityType & 0x20)
    return this.useCommandCardAbility(eventHeader, curs, flag, abilityType);
  else if(abilityType & 0x40) {
    if(flag & 0x08)
      return this.doRightClickMove(eventHeader, curs, flag, abilityType);
    else if(flag === 0x04 || flag === 0x05 || flag === 0x07)
      return this.doLocationMove(eventHeader, curs, flag, abilityType);
  }
  else if(abilityType & 0x80)
    return this.doRightClickTarget(eventHeader, curs, flag, abilityType);

  throw new Error('Unrecognized ability type: ' + abilityType.toString(16));
};

ActionParser16561.prototype.useCommandCardAbility = function(eventHeader, curs, flag, abilityType) {
  var abilityData = curs.read(2),
      abilityCode = (abilityData[0] << 8) | abilityData[1];

  if(flag === 0x29 || flag === 0x19 || flag === 0x14 || flag === 0x0C) {
    // cancels
    abilityCode = (abilityCode << 8) | curs.read()[0];
    curs.skip(4); // TODO: this is the object ID of the thing cancelled I believe
    return new gameEvents.AbilityEvent(eventHeader, abilityCode);
  }

  var nib = new Nibbler(curs),
      abilityFlags = nib.readBits(6)[0];
  abilityCode = (abilityCode << 8) | abilityFlags;

  if(abilityFlags & 0x10) {
    nib.readBytes(5); // TODO: this is the event coords, 2.5 bytes for X and 2.5 for Y
    curs.skip(4);
    return new gameEvents.AbilityEvent(eventHeader, abilityCode);
  }
  else if(abilityFlags & 0x20) {
    curs.skip(18);
    return new gameEvents.AbilityEvent(eventHeader, abilityCode);
  }
  else {
    return new gameEvents.AbilityEvent(eventHeader, abilityCode);
  }
};

ActionParser16561.prototype.doRightClickMove = function(eventHeader, curs, flag, abilityType) {
  curs.skip(5); // TODO: location
  curs.skip(5);
  return new gameEvents.AbilityEvent(eventHeader, 0x27272727); // TODO: get rid of temp code and make a type :)
};

ActionParser16561.prototype.doLocationMove = function(eventHeader, curs, flag, abilityType) {
  var abilityData = curs.read(2),
      abilityCode = (abilityData[0] << 8) | abilityData[1];

  if(abilityCode & 0x20)
    curs.skip(9);
  else if(abilityCode & 0x40)
    curs.skip(18);

  return new gameEvents.AbilityEvent(eventHeader, abilityCode);
};

ActionParser16561.prototype.doRightClickTarget = function(eventHeader, curs, flag, abilityType) {
  var abilityData = curs.read(2),
      abilityCode = (abilityData[0] << 8) | abilityData[1];

  curs.skip(4); // TODO: object id
  curs.skip(2); // TODO: object type
  curs.skip(10);
  return new gameEvents.AbilityEvent(eventHeader, abilityCode);
};

var parserVersions = [
  {minBuild: 0, parser: ActionParser},
  {minBuild: 16561, parser: ActionParser16561}
  // TODO: fill this out as more parser versions get added
];

