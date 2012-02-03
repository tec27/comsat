var Bz = require('./blizzerial'),
    EventEmitter = require('events').EventEmitter;

var headerParser = Bz()
                    .BzHash('header', Bz()
                      .BzString('unknown0', true)
                      .BzHash('version',
                        Bz()
                          .BzIntV('unknown0')
                          .BzIntV('major')
                          .BzIntV('minor')
                          .BzIntV('patch')
                          .BzIntV('build')
                          .BzIntV('unknown1')
                      )
                      .BzIntV('unknown1')
                      .BzIntV('gameLength')
                    );

module.exports.parse = function(data) {
  var emitter = new EventEmitter();

  process.nextTick(function() {
    var result;
    try {
      result = headerParser.execute(data);
    }
    catch(err) {
      return emitter.emit('error', err);
    }

    emitter.emit('success', result.header);
  });

  return emitter;
};
