var Nibbler = require('parsers/nibbler'),
    Cursorize = require('parsers/cursorize'),
    should = require('should');

describe('Nibbler', function() {
  describe('readBits', function() {
    var nib;
    beforeEach(function() {
      var buf = new Buffer([ 0xF0, 0x0F, 0xFF ]);
      var curs = new Cursorize(buf);
      nib = new Nibbler(curs);
    });
    it('should throw if cnt <= 0', function() {
      (function() { nib.readBits(-1); }).should.throw();
      (function() { nib.readBits(0); }).should.throw();
    });
    it('should be able to read <= 8 bits', function() {
      (nib.readBits(4)[0]).should.equal(0);
      (nib.readBits(4)[0]).should.equal(15);
    });
    it('should be able to read multiple bytes when not shifted', function() {
      var ret = nib.readBits(24);
      ret[0].should.equal(0xF0);
      ret[1].should.equal(0x0F);
      ret[2].should.equal(0xFF);
    });
    it('should be able to read whole bytes followed by a partial one when not shifted', function() {
      var ret = nib.readBits(20);
      // bits:
      // |1111 0000|  |0000 1111|  1111 |1111|
      ret[0].should.equal(0xF0);
      ret[1].should.equal(0x0F);
      ret[2].should.equal(0xF);
    });
    it('should be able to read multiple bytes when shifted', function() {
      nib.readBits(4);
      var ret = nib.readBits(16);
      // bits look like:
      // 1111 0000  0000 1111  1111 1111
      //  Ah  ----   Al   Bh         Bl
      ret[0].should.equal(0xF0);
      ret[1].should.equal(0xFF);
    });
    it('should be able to read a byte and a partial byte (over a boundary) when shifted', function() {
      nib.readBits(4);
      var ret = nib.readBits(13);
      // bits look like:
      // 1111 0000  0000 1111  1111 1111
      //  Ah  ----   Al   Bh         Bl (0x1 bit only)
      ret[0].should.equal(0xF0);
      ret[1].should.equal(0x1F);

      nib.shifted.should.equal(1);
    });
    it('should be able to read a byte and a partial byte (not over a boundary) when shifted', function() {
      var buf = new Buffer([0xF0, 0xFA, 0xFA]);
      var curs = new Cursorize(buf);
      nib = new Nibbler(curs);
      nib.readBits(4);
      var ret = nib.readBits(11);
      // bits look like:
      // 1111 0000  1111 1010  1111 1010
      //  Ah  ----   bbb  Al
      ret[0].should.equal(0xFA);
      ret[1].should.equal(0x7);

      curs.rollback();
      nib = new Nibbler(curs);
      nib.readBits(4);
      ret = nib.readBits(19);
      // bits look like:
      // 1111 0000  1111 1010  1111 1010
      // AAAA ----  aaaa BBBB   ccc bbbb
      ret[0].should.equal(0xFF);
      ret[1].should.equal(0xAA);
      ret[2].should.equal(0x7);
    });
    it('should be able to read more than 4 bytes correctly when shifted', function() {
      var buf = new Buffer([0x74, 0x65, 0x63, 0x32, 0x37, 0x21]);
      var curs = new Cursorize(buf);
      nib = new Nibbler(curs);
      nib.readBits(4);
      // bits look like:
      // 0111 0100  0110 0101  0110 0011  0011  0010 0011 0111  0011 0001
      //  Ah  ----   Al   Bh    Bl   Ch    Cl    Dh   Dl   Eh         El
      var ret = nib.readBits(40);
      ret[0].should.equal(0x76);
      ret[1].should.equal(0x56);
      ret[2].should.equal(0x33);
      ret[3].should.equal(0x23);
      ret[4].should.equal(0x71);

      // just to make sure less even divisions work as well:
      curs.rollback();
      nib = new Nibbler(curs);
      nib.readBits(3);
      // bits look like:
      // 0111 0100  0110 0101  0110 0011  0011 0010  0011 0111  0011 0001
      // AAAA A---  aaaB BBBB  bbbC CCCC  cccD DDDD  dddE EEEE        eee
      ret = nib.readBits(40);
      ret[0].should.equal(0x73);
      ret[1].should.equal(0x2B);
      ret[2].should.equal(0x19);
      ret[3].should.equal(0x91);
      ret[4].should.equal(0xB9);
    });
    it('should be able to read a very small number of bits across multiple bytes', function() {
      var buf = new Buffer([0xF0, 0xFA, 0x8E]);
      var curs = new Cursorize(buf);
      nib = new Nibbler(curs);
      nib.readBits(14);
      var ret = nib.readBits(3);
      // bits look like:
      // 1111 0000  1111 1010  1000 1110
      // ---- ----  AA-- ----          a
      ret[0].should.equal(0x6);
    });
    it('should be able to read from a shifted state to a non-shifted state across a byte boundary', function() {
      var buf = new Buffer([0xF0, 0xFA, 0x8E]);
      var curs = new Cursorize(buf);
      nib = new Nibbler(curs);
      nib.readBits(2);
      var ret = nib.readBits(14);
      // bits look like:
      // 1111 0000  1111 1010  1000 1110
      // AAAA aa--  aaBB bbbb
      ret.length.should.equal(2);
      ret[0].should.equal(0xF3);
      ret[1].should.equal(0x3A);
    });
  });

  describe('readToBoundary', function() {
    var nib;
    beforeEach(function() {
      var buf = new Buffer([ 0xF0, 0x0F, 0xFF ]);
      var curs = new Cursorize(buf);
      nib = new Nibbler(curs);
    });
    it('should return an empty array when not shifted', function() {
      nib.readToBoundary().should.be.empty;
    });
    it('should return the remainder of the last byte when not shifted', function() {
      nib.readBits(4);
      (nib.readToBoundary()[0]).should.be.equal(0xF);
    });
    it('should restore the shifting to 0', function() {
      nib.readBits(4);
      nib.readToBoundary();
      nib.readToBoundary().should.be.empty;
    });
  });
});
