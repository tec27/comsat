var blizzerial = require('./blizzerial'),
    EventEmitter = require('events').EventEmitter;

var headerMap = [ { name: 'unknown0', type: 'string' },
                  { name: 'version', map: [ 'unknown0', 'major', 'minor', 'patch', 'build', 'unknown1' ] },
                  'unknown1',
                  'game_length' ];


module.exports.parse = function(data) {
  var emitter = new EventEmitter();

  blizzerial.parse(data, headerMap, function onParsedHeader(err, header) {
    if(err)
      emitter.emit('error', err);
    else
      emitter.emit('success', header);
  });

  return emitter;
}
