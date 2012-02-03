var Cursorize = require('parsers/cursorize'),
    should = require('should');

describe('Cursorize', function() {
  describe('Constructor', function() {
    it('should set parameters when all given', function() {
      var cur = new Cursorize('a', 'b', 'c');
      cur.buffer.should.eql('a');
      cur.hesitant.should.eql('b');
      cur.pos.should.eql('c');
    });
    it('should default pos to 0', function() {
      var cur = new Cursorize('a', 'b');
      cur.pos.should.equal(0);
    });
    it('should default hesitant to true', function() {
      var cur = new Cursorize('a');
      cur.hesitant.should.equal(true);
    });
    it('should return a new object without the new keyword', function() {
      var cur = Cursorize('a', 'b', 'c');
      (cur instanceof Cursorize).should.eql.true;
    });
  });

  describe('#commit', function() {
    var cur;

    beforeEach(function() {
      cur = new Cursorize('stub');
      cur.pos = 5;
    });

    it('should return the current position', function() {
      cur.commit().should.equal(cur.pos);
    });
    it('should change the committed position to the current position', function() {
      var pos = cur.commit();
      cur.committedPos.should.equal(pos);
    });
    it('should do nothing in non-hesitant mode', function() {
      cur.hesitant = false;
      cur.commit().should.equal(5);
      cur.committedPos.should.equal(0);
    });
  });

  describe('#rollback', function() {
    var cur;
    beforeEach(function() {
      cur = new Cursorize('stub');
      cur.pos = 4;
    });

    it('should return the new position', function() {
      cur.rollback().should.equal(cur.pos);
    });
    it('should change the current position to the committed position', function() {
      cur.rollback();
      cur.pos.should.equal(cur.committedPos);
    });
    it('should do nothing in non-hesitant mode', function() {
      cur.hesitant = false;
      cur.rollback().should.equal(4);
    });
  });

  describe('#read', function() {
    var cur,
    initData = [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 ];
    beforeEach(function() {
      cur = new Cursorize(new Buffer(initData));
    });

    it('should return an array of data', function() {
      cur.read().should.be.an.instanceof(Array);
    });
    it('should default to size 1', function() {
      cur.read().length.should.eql(1);
    });
    it('should increment the position by the amount read', function() {
      var pos = cur.pos;
      cur.read(3);
      cur.pos.should.equal(pos+3);
    });
    it('should return the correct data size', function() {
      cur.read(5).length.should.eql(5);
    });
    it('should return the data from that location in the buffer', function() {
      cur.read()[0].should.equal(0);
      cur.read(2).join('-').should.equal('1-2');
      cur.read(3).join('-').should.equal('3-4-5');
      cur.read(4).join('-').should.equal('6-7-8-9');
      cur.read(5).join('-').should.equal('10-11-12-13-14');
    });
    it('should throw when there is not enough data left', function() {
      (function() { cur.read(initData.length + 1); }).should.throw();
    });
    it('should throw when you try to read a length <= 0', function() {
      (function() { cur.read(-1); }).should.throw();
      (function() { cur.read(0);  }).should.throw();
    });
  });

  describe('#skip', function() {
    var cur,
    initData = [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 ];
    beforeEach(function() {
      cur = new Cursorize(new Buffer(initData));
    });

    it('should return the new position', function() {
      cur.skip(4).should.equal(4).and.equal(cur.pos);
    });
    it('should default to a size of 1', function() {
      cur.skip().should.equal(1);
    });
    it('should throw when there is not enough data left', function() {
      (function() { cur.skip(initData.length + 1); }).should.throw();
    });
    it('should throw when you try to skip a length <= 0', function() {
      (function() { cur.skip(-1); }).should.throw();
      (function() { cur.skip(0); }).should.throw();
    });
  });

  describe('#rewind', function() {
    var cur,
    initData = [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 ];
    beforeEach(function() {
      cur = new Cursorize(new Buffer(initData), false, 17);
    });

    it('should return the new position', function() {
      cur.rewind(4).should.equal(13).and.equal(cur.pos);
    });
    it('should default to a size of 1', function() {
      cur.rewind().should.equal(16);
    });
    it('should throw when there is not enough data left', function() {
      (function() { cur.rewind(initData.length + 1); }).should.throw();
    });
    it('should throw when you try to rewind a length <= 0', function() {
      (function() { cur.rewind(-1); }).should.throw();
      (function() { cur.rewind(0); }).should.throw();
    });
  });

  describe('#left', function() {
    var cur,
    initData = [ 0, 1, 2, 3, 4, 5, 6, 7, 8 ];
    beforeEach(function() {
      cur = new Cursorize(new Buffer(initData));
    });

    it('should return the amount of data left', function() {
      cur.left().should.equal(initData.length);
    });
    it('should be change when pos changes', function() {
      cur.skip(4);
      cur.left().should.equal(initData.length - 4);
    });
  });

  describe('#readBuf', function() {
    var cur,
    initData = [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 ];
    beforeEach(function() {
      cur = new Cursorize(new Buffer(initData));
    });

    it('should default to size 1', function() {
      var defRead = cur.readBuf();
      var specRead = cur.readBuf(1);
      defRead.length.should.equal(specRead.length);
    });
    it('should return a Buffer', function() {
      cur.readBuf().should.be.an.instanceof(Buffer);
    });
    it('should return the correct amount of data', function() {
      cur.readBuf(1).length.should.equal(1);
      cur.readBuf(5).length.should.equal(5);
    });
    it('should increment the position', function() {
      var p = cur.pos;
      cur.readBuf(4);
      cur.pos.should.equal(p + 4);
    });
    it('should not throw when you read the rest of the buffer', function() {
      (function() { cur.readBuf(initData.length); }).should.not.throw();
    });
    it('should throw when there is not enough data left', function() {
      (function() { cur.readBuf(initData.length+1); }).should.throw();
    });
    it('should throw when you try to read <= 0', function() {
      (function() { cur.readBuf(-1); }).should.throw();
      (function() { cur.readBuf(0); }).should.throw();
    });
  });
});
