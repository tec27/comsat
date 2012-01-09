var EventEmitter = require('events').EventEmitter;

var parseAttributes = module.exports.parse = function parseAttributes(data, version) {
  var emitter = new EventEmitter();

  process.nextTick(function onAttributesNextTick() {
    if(data[4] == 0) { // newer versions have 5 null bytes instead of 4 at start
      data = data.slice(5);
    }
    else {
      data = data.slice(4);
    }

    var numAttributes = readInt32(data);
    data = data.slice(4);
    var attributes = [ ];

    for(var i = 0; i < numAttributes; i++) {
      if(!(data[0] == 0xE7 && data[1] == 0x03 && data[2] == 0x0 && data[3] == 0x0) || data.length < 13) {
        return emitter.emit('error', new Error('Invalid attributes file.'));
      }

      data = data.slice(4);
      var id = readInt32(data);
      data = data.slice(4);
      var playerNum = readInt8(data)-1;
      data = data.slice(1);
      var value = readAttributeValue(data);
      data = data.slice(4);

      attributes[id] = attributes[id] || [ ];
      attributes[id][playerNum] = value;
    }

    emitter.emit('success', attributes);
  });

  return emitter;
}

function readInt32(data) {
  var int32 = (data[3] << 24) | (data[2] << 16) | (data[1] << 8) | (data[0]);

  return int32;
}

function readInt8(data) {
  return data[0];
}

function readAttributeValue(data) {
  var chars = data.toString('utf8', 0, 4).split('');
  var i = 0;
  while(chars[i] != '\u0000' && i < chars.length) i++;
  chars = chars.slice(0,i);
  return chars.reverse().join(''); // everything is stored little endian, so strings are backwards
}

var attributeNames = module.exports.attributeNames = {
  PlayerType: 0x01F4,
  Format: 0x07D1,
  GameSpeed: 0x0BB8,
  PlayerRace: 0x0BB9,
  PlayerColor: 0x0BBA,
  Handicap: 0x0BBB,
  Difficulty: 0x0BBC,
  GameType: 0x0BC1,
  Teams1v1: 0x07D2,
  Teams2v2: 0x07D3,
  Teams3v3: 0x07D4,
  Teams4v4: 0x07D5,
  TeamsFFA: 0x07D6,
  Teams6v6: 0x07D8,
};

module.exports.playerType = function(val) {
  switch(val) {
    case 'Humn': return 'Human';
    case 'Comp': return 'Computer';
    case 'Open': return 'Open';
    case 'Clsd': return 'Closed';
    default: return 'Unknown';
  }
}

module.exports.format = function(val) {
  switch(val) {
    case 'Cust': return 'Custom';
    default: return val;
  }
}

module.exports.gameSpeed = function(val) {
  switch(val) {
    case 'Slor': return 'Slower';
    case 'Slow': return 'Slow';
    case 'Norm': return 'Normal';
    case 'Fast': return 'Fast';
    case 'Fasr': return 'Faster';
    default: return 'Unknown';
  }
}

module.exports.playerRace = function(val) {
  var ret = { value: null, random: false };
  switch(val) {
    case 'RAND': ret.random = true; break;
    case 'Terr': ret.value = 'Terran'; break;
    case 'Prot': ret.value = 'Protoss'; break;
    case 'Zerg': ret.value = 'Zerg'; break;
  }

  return ret;
}

module.exports.playerColor = function(val) {
  switch(val) {
    case 'tc01': return 'Red';
    case 'tc02': return 'Blue';
    case 'tc03': return 'Teal';
    case 'tc04': return 'Purple';
    case 'tc05': return 'Yellow';
    case 'tc06': return 'Orange';
    case 'tc07': return 'Green';
    case 'tc08': return 'Light Pink';
    case 'tc09': return 'Violet';
    case 'tc10': return 'Light Grey';
    case 'tc11': return 'Dark Green';
    case 'tc12': return 'Brown';
    case 'tc13': return 'Light Green';
    case 'tc14': return 'Dark Grey';
    case 'tc15': return 'Pink';
    default: return 'Unknown';
  }
}

module.exports.difficulty = function(val) {
  switch(val) {
    case 'VyEy': return 'Very Easy';
    case 'Easy': return 'Easy';
    case 'Medi': return 'Medium';
    case 'Hard': return 'Hard';
    case 'VyHd': return 'Very Hard';
    case 'Insa': return 'Insane';
    default: return 'Unknown';
  }
}

module.exports.gameType = function(val) {
  switch(val) {
    case 'Priv': return 'Private';
    case 'Amm': return 'AutoMM';
    case 'Pub': return 'Public';
  }
}
