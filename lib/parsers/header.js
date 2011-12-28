var blizzerial = require('./blizzerial')

var headerMap = [ { name: 'unknown0', type: 'string' },
                  { name: 'version', map: [ 'unknown0', 'major', 'minor', 'patch', 'build', 'unknown1' ] },
                  'unknown1',
                  'game_length' ];


var parseHeader = module.exports.parse = function parseHeader(err, data, callback) {
  if(err) {
    callback(err, null);
    return;
  }

  blizzerial.parse(data, headerMap, function onParsedHeader(err, header) {
    if(err)
      callback(err)
    else
      callback(null, header)
  });
}

