// A simple buffer wrapper that keeps track of a current position, including the ability
//  to commit and rollback the position (if its opened in hesitant mode). Will throw
//  when there is not enough data in the buffer to complete the request.
module.exports = Cursorize;

function Cursorize(buffer, hesitant, pos) {
  if(!(this instanceof Cursorize)) return new Cursorize(buffer, hesitant, pos);

  this.buffer = buffer;
  this.pos = pos || 0;
  if(typeof hesitant !== 'undefined')
    this.hesitant = hesitant;
  else
    this.hesitant = true;

  this.committedPos = this.pos;
}

Cursorize.NotEnoughData = function() {
  this.message = 'Cursorize: Not enough data to complete request';
};

Cursorize.prototype._enough = function(cnt) {
  if(this.left() < cnt) {
    throw new Cursorize.NotEnoughData();
  }
};

Cursorize.prototype._incPos = function(cnt) {
  return this.pos += cnt;
};

Cursorize.prototype.commit = function() {
  if(!this.hesitant) return this.pos;
  return this.committedPos = this.pos;
};

Cursorize.prototype.rollback = function() {
  if(!this.hesitant) return this.pos;
  return this.pos = this.committedPos;
};

Cursorize.prototype.read = function(cnt) {
  if(typeof cnt === 'undefined') cnt = 1;
  if(cnt <= 0) throw new RangeError('cnt must be greater than 0');
  this._enough(cnt);
  var p = this.pos;
  this._incPos(cnt);

  // some quick, common cases pre-coded for speed
  var ret;
  switch(cnt) {
    case 1: ret = [ this.buffer[p+0] ]; break;
    case 2: ret = [ this.buffer[p+0], this.buffer[p+1] ]; break;
    case 3: ret = [ this.buffer[p+0], this.buffer[p+1], this.buffer[p+2] ]; break;
    default: ret = [ this.buffer[p+0], this.buffer[p+1], this.buffer[p+2], this.buffer[p+3] ]; break;
  }
  if(cnt <= 4) return ret;

  for(cnt -= 4, p += 4; cnt > 0; p++, cnt--) {
    ret.push(this.buffer[p]);
  }

  return ret;
};

Cursorize.prototype.skip = function(cnt) {
  if(typeof cnt === 'undefined') cnt = 1;
  if(cnt <= 0) throw new RangeError('cnt must be greater than 0');
  this._enough(cnt);
  return this._incPos(cnt);
};

Cursorize.prototype.rewind = function(cnt) {
  if(typeof cnt === 'undefined') cnt = 1;
  if(cnt <= 0) throw new RangeError('cnt must be greater than 0');
  if(cnt > this.pos) throw new RangeError('cnt must be less than pos');
  return this._incPos(-cnt);
};

Cursorize.prototype.left = function() {
  return this.buffer.length - this.pos;
};

Cursorize.prototype.readBuf = function(cnt) {
  if(typeof cnt === 'undefined') cnt = 1;
  if(cnt <=  0) throw new RangeError('cnt must be greater than 0');

  this._enough(cnt);
  var p = this.pos;
  this._incPos(cnt);
  return this.buffer.slice(p, p+cnt);
};
