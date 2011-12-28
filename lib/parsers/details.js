var blizzerial = require('./blizzerial')

var detailsPlayerId = [ "unknown0", "s2", "unknown1", "empty0", "realId" ];
var detailsPlayerColor = [ "alpha", "red", "green", "blue" ];
var detailsPlayers = [ { name: 'name', type: 'string' },
                      { name: 'idInfo', map: detailsPlayerId },
                      { name: 'race', type: 'string' },
                      { name: 'color', map: detailsPlayerColor },
                      'unknown0',
                      'team',
                      'handicap',
                      'unknown1',
                      'outcome' ];
var detailsMap = [ { name: 'players', map: detailsPlayers, type: 'array' },
                  { name: 'mapName', type: 'string' },
                  'unknown0',
                  { name: 'mapInfo', map: [ { name: 'minimap', type: 'string' } ] },
                  'unknown1',
                  'datetime',
                  'timezoneOffset',
                  'unknown2',
                  'unknown3',
                  'unknown4',
                  'mapFiles',
                  'unknown5',
                  'unknown6',
                  'unknown7' ];


var parseDetails = module.exports.parse = function parseDetails(err, data, version, callback) {
  if(err) {
    callback(err, null);
    return;
  }

  blizzerial.parse(data, detailsMap, function onParsedDetails(err, details) {
    if(err) {
      callback(err);
      return;
    }

    convertMapHashesToFilenames(details);
    callback(null, details);
  });
}

function convertMapHashesToFilenames(repDetails) {
  var hexDigits = '0123456789abcdef';

  for(var i = 0; i < repDetails.mapFiles.length; i++) {
    var hashBuffer = repDetails.mapFiles[i];
    var str_s2ma = hashBuffer.toString('utf8', 0, 4);

    var region = hashBuffer.toString('utf8', 6, 8);
    hashBuffer = hashBuffer.slice(8); // remove s2ma\x00\x00(US|EU|KR|...)
    var filename = '';
    for(var j = 0; j < hashBuffer.length; j++) {
      var byteVal = hashBuffer[j];
      filename += ( hexDigits[ byteVal >> 4 ] + hexDigits[ byteVal & 0x0F ] );
    }

    repDetails.mapFiles[i] = { region: region, filename: filename };
  }
}
