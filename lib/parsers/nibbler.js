// Nibbler - wrapper for Cursorize that allows for reading things that don't fall on even byte boundaries
// (individual bits, reading 5 bits from one byte and 3 bits from the next, etc.)

// Yes, this name is a reference to Futurama. And yes, like the character there, this will likely
// shit up your program with really valuable functionality!

var Nibbler = module.exports = function(curs) {
  if(!(this instanceof Nibbler)) return new Nibbler(curs);

  this.curs = curs;
  this.shifted = 0;
};

var loBitMask = [ 0, 1, 3, 7, 15, 31, 63, 127, 255 ];

Nibbler.prototype._shift = function(cnt) {
  if(this.shifted + cnt > 8) throw new RangeError('Not enough bits remaining.');

  if(!this.shifted)
    this.data = this.curs.read()[0];

  var val = (this.data >> this.shifted) & loBitMask[cnt];
  this.shifted = (this.shifted + cnt) % 8;
  return val;
};

Nibbler.prototype.readBits = function(cnt) {
  if(cnt <= 0) throw new RangeError('cnt must be > 0');

  if(this.shifted + cnt <= 8)
    return [ this._shift(cnt) ];

  var val;
  if(!this.shifted) {
    val = this.curs.read(cnt >>> 3);
    var numBits = cnt % 8;
    if(numBits > 0) val.push(this._shift(numBits));
    return val;
  }

  val = [];
  var rightBits = this.shifted,
      rightLoMask = loBitMask[rightBits],
      leftBits = 8 - rightBits,
      info = { cnt: cnt };

  info.cnt -= leftBits;
  info.buffer = ((0xFF ^ rightLoMask) & this.data) << leftBits; // top (8-shifted) bits right-aligned at 2nd byte

  if(info.cnt >= 8) {
    this._readMiddleBytes(val, info, leftBits);
    if(info.cnt === 0)
      return val;
  }

  // number of bits in the buffer at this point is leftBits
  this.shifted = this._readEndByte(val, info, rightBits);
  if(info.cnt > 0) // still a few more bits left to read from this byte after finishing the last full byte
    val.push(this._shift(info.cnt));

  return val;
};

Nibbler.prototype._readMiddleBytes = function(val, info, leftBits) {
  var leftLoMask = loBitMask[leftBits]; // this is the mask for left # of bits RIGHT ALIGNED

  while(info.cnt >= 8) {
    this.data = this.curs.read()[0];
    info.buffer |= this.data;
    val.push(info.buffer >>> leftBits);
    info.buffer = (info.buffer & leftLoMask); // get rid of the extra data to the left now
    info.cnt -= 8;
    info.buffer <<= 8; // shift in space for the next byte
  }
}

Nibbler.prototype._readEndByte = function(val, info, rightBits) {
  if(info.cnt < rightBits)
    rightBits = info.cnt;
  info.buffer >>>= (8 - rightBits);
  this.data = this.curs.read()[0];
  info.buffer |= this.data & loBitMask[rightBits];
  val.push(info.buffer);
  info.cnt -= rightBits;

  return rightBits;
}

Nibbler.prototype.readBytes = function(cnt) {
  return this.readBits(cnt << 3);
};

Nibbler.prototype.readCombo = function(nBytes, nBits) {
  return this.readBits((nBytes << 3) + nBits);
};

Nibbler.prototype.readToBoundary = function() {
  if(this.shifted === 0) return [];
  var val = [ (this.data & (0xFF ^ loBitMask[this.shifted])) >>> this.shifted ];
  this.shifted = 0;
  return val;
};
