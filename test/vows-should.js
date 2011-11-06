// adds vows-friendly exist and not.exist functions to should, instead
//  of the default ones, which cause exceptions

// Usage: var should = require('./vows-should')(require('should'));

var util = require('util');

module.exports = function(should) {
  should.exist = function(obj, msg) {
    should.ok(obj != null, msg || ('expected ' + util.inspect(obj) + ' to exist'));
  }

  should.not.exist = function(obj, msg) {
    should.ok(obj == null, msg || ('expected ' + util.inspect(obj) + ' to not exist'));
  }

  return should;
}
