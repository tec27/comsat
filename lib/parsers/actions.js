var EventEmitter = require('events').EventEmitter;

var parseActions = module.exports.parse = function parseGameEvents(stream, version) {
}

var eventTypeParsers = { 
  0x00: parseInitialization,
  0x01: parsePlayerActions,
  0x02: parseUnknown2,
  0x03: parseCameraMovement,
  0x04: parseUnknown4,
  0x05: parseUnknown5
}

// Plan for Parsers:
//  - make one for each event code thing (join event, start event, ability event, selection event, etc.)
//  - make a base class for the initial version with all of the functions for parsing these (leave functions blank if such an event didn't exist then)
//  - inherit from that class and override things in prototype that changed
//  - pick the right version at start of module.parse() and use it
//  - gg
//  - re?
