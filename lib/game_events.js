var util = require('util');

module.exports = {
  GameEvent: GameEvent,
  JoinEvent: JoinEvent,
  LeaveEvent: LeaveEvent,
  StartEvent: StartEvent,
  AllianceChangeEvent: AllianceChangeEvent,
  GameSpeedChangeEvent: GameSpeedChangeEvent,
  IncreaseGameSpeedEvent: IncreaseGameSpeedEvent,
  DecreaseGameSpeedEvent: DecreaseGameSpeedEvent,
  MoveScreenEvent: MoveScreenEvent,
  SelectionEvent: SelectionEvent,
  AbilityEvent: AbilityEvent,
  HotkeyEvent: HotkeyEvent,
  SetHotkeyEvent: SetHotkeyEvent,
  AddToHotkeyEvent: AddToHotkeyEvent,
  GetHotkeyEvent: GetHotkeyEvent,
  ResourceTransferEvent: ResourceTransferEvent,
  ResourceRequestEvent: ResourceRequestEvent,
  CancelResourceRequestEvent: CancelResourceRequestEvent,
  UnknownEvent: UnknownEvent
};

function GameEvent(eventHeader) {
  this.frame = eventHeader.frame;
  this.playerId = eventHeader.player;
  this.type = eventHeader.type;
  this.code = eventHeader.code;
  this.name = '';
}

function UnknownEvent(eventHeader, data) {
  UnknownEvent.super_.call(this, eventHeader);

  this.name = 'Unknown';
  this.data = data;
}
util.inherits(UnknownEvent, GameEvent);

function JoinEvent(eventHeader) {
  JoinEvent.super_.call(this, eventHeader);

  this.name = 'PlayerJoin';
}
util.inherits(JoinEvent, GameEvent);

function LeaveEvent(eventHeader) {
  LeaveEvent.super_.call(this, eventHeader);

  this.name = 'PlayerLeave';
}
util.inherits(LeaveEvent, GameEvent);

function StartEvent(eventHeader) {
  StartEvent.super_.call(this, eventHeader);

  this.name = 'GameStart';
}
util.inherits(StartEvent, GameEvent);

function AllianceChangeEvent(eventHeader, ukData) {
  AllianceChangeEvent.super_.call(this, eventHeader);

  this.name = 'AllianceChange';
  this.ukData = ukData;
}
util.inherits(AllianceChangeEvent, GameEvent);



function GameSpeedChangeEvent(eventHeader, ukByte) {
  GameSpeedChangeEvent.super_.call(this, eventHeader);

  this.name = 'GameSpeedChange';
  this.ukByte = ukByte;
}
util.inherits(GameSpeedChangeEvent, GameEvent);

function IncreaseGameSpeedEvent(eventHeader, ukByte) {
  IncreaseGameSpeedEvent.super_.call(this, eventHeader, ukByte);

  this.name = 'IncreaseGameSpeed';
}
util.inherits(IncreaseGameSpeedEvent, GameSpeedChangeEvent);

function DecreaseGameSpeedEvent(eventHeader, ukByte) {
  DecreaseGameSpeedEvent.super_.call(this, eventHeader, ukByte);

  this.name = 'DecreaseGameSpeed';
}
util.inherits(DecreaseGameSpeedEvent, GameSpeedChangeEvent);


function MoveScreenEvent(eventHeader, x, y, flags, zooming, rotating) {
  MoveScreenEvent.super_.call(this, eventHeader);

  this.name = 'MoveScreen';

  this.x = x;
  this.y = y;
  this.flags = flags;
  this.zooming = zooming;
  this.rotating = rotating;
}
util.inherits(MoveScreenEvent, GameEvent);


function SelectionEvent(eventHeader, wasAutomatic, deselectionMap, unitTypes, unitIds, mode, modeData) {
  SelectionEvent.super_.call(this, eventHeader);

  this.name = 'SelectionEvent';

  this.wasAutomatic = wasAutomatic;
  this.deselectionMap = deselectionMap;
  this.unitTypes = unitTypes;
  this.unitIds = unitIds;
  this.mode = mode;
  this.modeData = modeData;
}
util.inherits(SelectionEvent, GameEvent);


function AbilityEvent(eventHeader, abilityCode) {
  AbilityEvent.super_.call(this, eventHeader);

  this.name = 'AbilityEvent';
  this.abilityCode = abilityCode;
}
util.inherits(AbilityEvent, GameEvent);


function HotkeyEvent(eventHeader, mask) {
  HotkeyEvent.super_.call(this, eventHeader);

  this.name = 'HotkeyEvent';
  this.hotkeyNum = eventHeader.code >> 4;
  this.mask = mask;
}
util.inherits(HotkeyEvent, GameEvent);

function SetHotkeyEvent(eventHeader, mask) {
  SetHotkeyEvent.super_.call(this, eventHeader, mask);

  this.name = 'SetHotkeyEvent';
}
util.inherits(SetHotkeyEvent, HotkeyEvent);

function AddToHotkeyEvent(eventHeader, mask) {
  AddToHotkeyEvent.super_.call(this, eventHeader, mask);

  this.name = 'AddToHotkeyEvent';
}
util.inherits(AddToHotkeyEvent, HotkeyEvent);

function GetHotkeyEvent(eventHeader, mask) {
  GetHotkeyEvent.super_.call(this, eventHeader, mask);

  this.name = 'GetHotkeyEvent';
}
util.inherits(GetHotkeyEvent, HotkeyEvent);


function ResourceTransferEvent(eventHeader, targetPlayer, minerals, gas) {
  ResourceTransferEvent.super_.call(this, eventHeader);

  this.name = 'ResourceTransferEvent';
  this.targetPlayer = targetPlayer;
  this.minerals = minerals;
  this.gas = gas;
}
util.inherits(ResourceTransferEvent, GameEvent);


function ResourceRequestEvent(eventHeader, minerals, gas) {
  ResourceRequestEvent.super_.call(this, eventHeader);

  this.name = 'ResourceRequestEvent';
  this.minerals = minerals;
  this.gas = gas;
}
util.inherits(ResourceRequestEvent, GameEvent);


function CancelResourceRequestEvent(eventHeader) {
  CancelResourceRequestEvent.super_.call(this, eventHeader);

  this.name = 'CancelResourceRequestEvent';
}
util.inherits(CancelResourceRequestEvent, GameEvent);
