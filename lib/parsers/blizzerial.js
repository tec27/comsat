// 3rd attempt at blizzerial parsing. Hopefully this time it will be easy to follow,
// easy to test, and fast. Pick 2. :D
var Cursorize = require('./cursorize'),
    BigInteger = require('bigdecimal').BigInteger;

var Blizzerial = module.exports = function() {
  if(!(this instanceof Blizzerial)) return new Blizzerial();

  this.chain = [];
};

Blizzerial.prototype.execute = function(buffer) {
  var curs = new Cursorize(buffer);
  var result = {};
  var entry;
  for(var i = 0; i < this.chain.length; i++) {
    entry = this.chain[i];
    result[entry.name] = entry.execute(curs);
  }

  return result;
};

var TYPES = {
  String: 2,
  Array: 4,
  Hash: 5,
  Int8: 6,
  Int32: 7,
  IntV: 9
};

function readType(curs) {
  return curs.read()[0];
}

function signAndShift(n) {
  return Math.pow(-1, n & 0x1) * (n >>> 1);
}

// we need this because IntV's are used as lengths all over the place, without a preceding type byte
function readIntV(curs) {
  var val, result = BigInteger.valueOf(0), cnt = 0;
  do {
    val = curs.read();
    result = result.add(BigInteger.valueOf(val & 0x7F).shiftLeft(7 * cnt++));
  } while(val >= 0x80);

  if(cnt <= 4) return signAndShift(result.intValue());
  else return result.shiftRight(1).multiply(BigInteger.valueOf(Math.pow(-1, result.intValue() & 0x1)));
}

Blizzerial.prototype.BzHash = function(name, blizzerial) {
  this.chain.push(new BzHash(name, blizzerial && blizzerial.chain));
  return this;
};

function BzHash(name, chains) {
  this.type = 'BzHash';
  this.name = name;
  this.chain = chains || [];
}

BzHash.prototype.execute = function(curs) {
  if(readType(curs) != TYPES.Hash)
    throw new Error('Tried to read ' + this.name + ' as a BzHash, but found incorrect type.');
  var len = readIntV(curs);
  var results = {};
  var entry;

  for(var i = 0; i < len; i++) {
    var entryNum = readIntV(curs);
    entry = this.chain[entryNum];
    results[entry.name] = entry.execute(curs);
  }

  return results;
};

Blizzerial.prototype.BzArray = function(name, blizzerial) {
  this.chain.push(new BzArray(name, blizzerial && blizzerial.chain));
  return this;
};

function BzArray(name, chains) {
  this.type = 'BzArray';
  this.name = name;
  this.chain = chains || [];
}

BzArray.prototype.execute = function(curs) {
  if(readType(curs) != TYPES.Array)
    throw new Error('Tried to read ' + this.name + ' as a BzArray, but found incorrect type.');
  curs.skip(2);
  var len = readIntV(curs);
  var results = [], entry;

  for(var i = 0; i < len; i++) {
    results[i] = {};
    for(var j = 0; j < this.chain.length; j++) {
      entry = this.chain[j];
      results[i][entry.name] = entry.execute(curs);
    }
  }

  return results;
};

Blizzerial.prototype.BzInt8 = function(name) {
  this.chain.push(new BzInt8(name));
  return this;
};

function BzInt8(name) {
  this.type = 'BzInt8';
  this.name = name;
}

BzInt8.prototype.execute = function(curs) {
  if(readType(curs) != TYPES.Int8)
    throw new Error('Tried to read ' + this.name + ' as a BzInt8, but found incorrect type.');

  return signAndShift(curs.read()[0]);
};

Blizzerial.prototype.BzInt32 = function(name) {
  this.chain.push(new BzInt32(name));
  return this;
};

function BzInt32(name) {
  this.type = 'BzInt32';
  this.name = name;
}

BzInt32.prototype.execute = function(curs) {
  if(readType(curs) != TYPES.Int32)
    throw new Error('Tried to read ' + this.name + ' as a BzInt32, but found incorrect type.');

  var bytes = curs.read(4);
  return signAndShift(bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24));
};

Blizzerial.prototype.BzIntV = function(name) {
  this.chain.push(new BzIntV(name));
  return this;
};

function BzIntV(name) {
  this.type = 'BzIntV';
  this.name = name;
}

BzIntV.prototype.execute = function(curs) {
  if(readType(curs) != TYPES.IntV)
    throw new Error('Tried to read ' + this.name + ' as a BzIntV, but found incorrect type.');

  return readIntV(curs);
};

Blizzerial.prototype.BzString = function(name, decode) {
  this.chain.push(new BzString(name, decode));
  return this;
};

function BzString(name, decode) {
  this.type = 'BzString';
  this.name = name;
  this.decode = decode;
}

BzString.prototype.execute = function(curs) {
  if(readType(curs) != TYPES.String)
    throw new Error('Tried to read ' + this.name + ' as a BzString, but found incorrect type.');

  var strLen = readIntV(curs);
  if(strLen === 0) return null;
  var buf = curs.readBuf(strLen);
  if(!this.decode) return buf;
  return buf.toString('utf8');
};
