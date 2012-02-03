var b = require('parsers/blizzerial'),
    should = require('should'),
    Cursorize = require('parsers/cursorize'),
    BigInteger = require('bigdecimal').BigInteger;

describe('Blizzerial', function() {
  describe('Constructor', function() {
    it('should return a new Blizzerial object when called without new', function() {
      var newB = b();
      newB.should.be.an.instanceof(b);
    });
    it('should empty the chain object', function() {
      var newB = b();
      newB.chain.push('rawrawrar');
      b.call(newB);
      newB.chain.should.be.empty;
    });
  });
  describe('#execute', function() {
    it('should return an object', function() {
      b().execute().should.be.an.instanceof(Object);
    });
    it('should call execute on each member of its chain', function() {
      var bz = b();
      var called = 0;
      bz.chain = [
        { name: '1', execute: function() { called++; } },
        { name: '2', execute: function() { called++; } }
      ];

      bz.execute();
      called.should.equal(2);
    });
    it('should return an object consisting of (name: executeRetVal) pairs from its chain', function() {
      var bz = b();
      bz.chain = [
        { name: 'one', execute: function() { return 1; } },
        { name: 'two', execute: function() { return 2; } }
      ];

      var result = bz.execute();
      result.one.should.equal(1);
      result.two.should.equal(2);
    });
    it('should not be destructive to the Blizzerial object', function() {
      var bz = b();
      var called = 0;
      bz.chain = [
        { name: '1', execute: function() { called++; } },
        { name: '2', execute: function() { called++; } }
      ];

      bz.execute();
      bz.execute()
      called.should.equal(4);
    });
  });
  describe('Type methods', function() {
    it('should be chainable', function() {
      var bz = b();
      bz.BzHash().should.equal(bz);
      bz.BzArray().should.equal(bz);
      bz.BzInt8().should.equal(bz);
      bz.BzInt32().should.equal(bz);
      bz.BzIntV().should.equal(bz);
      bz.BzString().should.equal(bz);
    });
    it('should append to the chain', function() {
      var bz = b();
      bz.chain.push('end');
      bz.BzHash('myhash');
      bz.chain.length.should.equal(2);
      bz.chain[0].should.equal('end');
      bz.chain[1].name.should.equal('myhash');
    });
  });
});

describe('BzHash', function() {
  describe('#execute', function() {
    it('should throw if an improper type is found', function() {
      var buf = new Buffer([0x1]);
      (function() { b().BzHash('asdf').execute(buf); }).should.throw();
    });
    it('should read the right number of entries', function() {
      var buf = new Buffer([0x5, 0x4, 0x0, 0x2]);
      var bz = b();
      var lastEntry = false;
      bz.chain = [
        { name: '1', execute: function() { } },
        { name: '2', execute: function() { lastEntry = true; } }
      ];

      b().BzHash('rawr', bz).execute(buf);
      lastEntry.should.be.true;
    });
    it('should call execute on all members of its chain that match a hash entry (and no more)', function() {
      var buf = new Buffer([0x5, 0x4, 0x0, 0x4]);
      var called = 0;
      var bz = b();
      bz.chain = [
        { name: '3', execute: function() { called += 3; } },
        { name: '5', execute: function() { called += 5; } },
        { name: '7', execute: function() { called += 7; } }
      ];

      b().BzHash('rawr', bz).execute(buf);
      called.should.equal(10);
    });
    it('should return an object that contains the value returned for each chain-member execed', function() {
      var buf = new Buffer([0x5, 0x4, 0x0, 0x4]);
      var bz = b();
      bz.chain = [
        { name: 'three', execute: function() { return 3; } },
        { name: 'five', execute: function() { return 5; } },
        { name: 'seven', execute: function() { return 7; } }
      ];

      var results = b().BzHash('rawr', bz).execute(buf).rawr;
      results.three.should.be.equal(3);
      results.seven.should.be.equal(7);
      should.not.exist(results.five);
    });
  });
});

describe('BzArray', function() {
  describe('#execute', function() {
    it('should throw if an improper type is found', function() {
      var buf = new Buffer([0x1]);
      (function() { b().BzArray('asdf').execute(buf); }).should.throw();
    });
    it('should read the right number of entries', function() {
      var buf = new Buffer([0x4, 0x1, 0x0, 0x4]);
      var bz = b();
      var lastEntryHit = 0;
      bz.chain = [
        { name: '1', execute: function() { } },
        { name: '2', execute: function() { lastEntryHit++; } }
      ];

      b().BzArray('rawr', bz).execute(buf);
      lastEntryHit.should.be.equal(2);
    });
    it('should return an array of results with each index containing all returns of the chain', function() {
      var buf = new Buffer([0x4, 0x1, 0x0, 0x4]);
      var bz = b();
      bz.chain = [
        { name: 'one', execute: function() { return 1; } },
        { name: 'two', execute: function() { return 2; } }
      ];

      var results = b().BzArray('rawr', bz).execute(buf).rawr;
      results.should.be.an.instanceof(Array);
      results[0].one.should.equal(1);
      results[0].two.should.equal(2);
      results[1].one.should.equal(1);
      results[1].two.should.equal(2);
    });
  });
});

describe('BzInt8', function() {
  describe('#execute', function() {
    var buf;
    beforeEach(function() {
      buf = new Buffer([ 0x6, 0xEE, 0x6, 0xFF, 0x6, 0xAA ]);
    });
    it('should throw if an improper type is found', function() {
      var buf = new Buffer([0x1]);
      (function() { b().BzInt8('asdf').execute(buf); }).should.throw();
    });
    it('should return a number', function() {
      var ret = b().BzInt8('ret').execute(buf).ret;
      (typeof ret).should.equal('number');
    });
    it('should use the 0x1 bit to determine sign', function() {
      buf[1] = buf[1] | 0x1;
      buf[3] = buf[3] & ~0x1;
      var ret = b().BzInt8('one').BzInt8('two').execute(buf);
      ret.one.should.be.below(0);
      ret.two.should.be.above(0);
    });
    it('should shift the sign bit off', function() {
      buf[1] = 0xA;
      buf[3] = 0xB;
      var ret = b().BzInt8('one').BzInt8('two').execute(buf);
      ret.one.should.equal(5);
      ret.two.should.equal(-5);
    });
  });
});

describe('BzInt32', function() {
  describe('#execute', function() {
    var buf;
    beforeEach(function() {
      buf = new Buffer([0x7, 0x32, 0x53, 0x0, 0x0]);
    });
    it('should throw if an improper type is found', function() {
      var buf = new Buffer([0x1]);
      (function() { b().BzInt32('asdf').execute(buf); }).should.throw();
    });
    it('should return a number', function() {
      var result = b().BzInt32('ret').execute(buf).ret;
      (typeof result).should.equal('number');
    });
    it('should use the 0x1 bit to determine sign', function() {
      buf[1] |= 0x1;
      b().BzInt32('ret').execute(buf).ret.should.be.below(0);
      buf[1] &= ~0x1;
      b().BzInt32('ret').execute(buf).ret.should.be.above(0);
    });
    it('should shift the sign bit off', function() {
      b().BzInt32('ret').execute(buf).ret.should.equal(10649);
      buf[1] = 0x33;
      b().BzInt32('ret').execute(buf).ret.should.equal(-10649);
    });
  });
});

describe('BzIntV', function() {
  describe('#execute', function() {
    it('should throw if an improper type is found', function() {
      var buf = new Buffer([0x1]);
      (function() { b().BzIntV('asdf').execute(buf); }).should.throw();
    });
    it('should read until it finds a byte that is < 0x80', function() {
      var buf = new Buffer([0x09, 0x01]);
      (function() { b().BzIntV('ret').execute(buf); }).should.not.throw();
      buf = new Buffer([ 0x09, 0x81, 0x81, 0x81 ]);
      (function() { b().BzIntV('ret').execute(buf); }).should.throw();
    });
    it('should return a number for values 4 bytes or less', function() {
      var buf = new Buffer([ 0x09, 0x81, 0x81, 0x7 ]);
      var result = b().BzIntV('ret').execute(buf).ret;
      (typeof result).should.equal('number');
    });
    it('should return a BigInteger for values >4 bytes', function() {
      var buf = new Buffer([ 0x09, 0x81, 0x81, 0x81, 0x81, 0x1 ]);
      var result = b().BzIntV('ret').execute(buf).ret;
      (typeof result).should.equal('object');
      result.should.be.an.instanceof(BigInteger);
    });
    it('should use the lo 7 bits from each byte, ORd together', function() {
      var buf = new Buffer([ 0x09, 0x82, 0x7 ]);
      var result = b().BzIntV('ret').execute(buf).ret;
      (result & 0x3F).should.equal((0x82 >> 1) & 0x3F);
      (result & (0x7F << 6)).should.equal(0x7 << 6);
    });
    it('should use the 0x1 bit to determine sign', function() {
      var buf = new Buffer([ 0x09, 0x2 ]);
      b().BzIntV('ret').execute(buf).ret.should.be.above(0);
      buf[1] = 0x3;
      b().BzIntV('ret').execute(buf).ret.should.be.below(0);

      buf = new Buffer([0x09, 0x82, 0x82, 0x82, 0x82, 0x82, 0x82, 0x82, 0x82, 0x01]);
      b().BzIntV('ret').execute(buf).ret.compareTo(BigInteger.valueOf(0)).should.be.above(0);
      buf[1] = 0x83;
      b().BzIntV('ret').execute(buf).ret.compareTo(BigInteger.valueOf(0)).should.be.below(0);
    });
  });
});

describe('BzString', function() {
  describe('#execute', function() {
    it('should throw if an improper type is found', function() {
      var buf = new Buffer([0x2]);
      (function() { b().BzString('asdf').execute(buf); }).should.throw();
    });
    it('should return null when length == 0', function() {
      var buf = new Buffer([0x2, 0x0, 0x44, 0x45, 0x46, 0x47]);
      var strBuf = b().BzString('ret').execute(buf).ret;
      should.not.exist(strBuf);
    });
    it('should return a buffer of the proper length when length > 0', function() {
      var buf = new Buffer([0x2, 0x8, 0x44, 0x45, 0x46, 0x47]);
      var strBuf = b().BzString('ret').execute(buf).ret;
      strBuf.should.be.an.instanceof(Buffer);
      strBuf.length.should.equal(4);
    });
    it('should decode the buffer to a string when set to decode', function() {
      var buf = new Buffer([0x2, 0x8, 0x44, 0x45, 0x46, 0x47]);
      var strBuf = b().BzString('ret', true).execute(buf).ret;
      strBuf.length.should.equal(4);
      strBuf.should.be.equal('DEFG');
    });
  });
});
