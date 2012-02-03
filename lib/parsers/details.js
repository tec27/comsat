var Bz = require('./blizzerial'),
    EventEmitter = require('events').EventEmitter;

var detailsParser =
  Bz()
    .BzHash('details', Bz()
      .BzArray('players', Bz()
        .BzHash('details', Bz()
          .BzString('name', true)
          .BzHash('idInfo', Bz()
            .BzIntV('unknown0')
            .BzInt32('s2')
            .BzIntV('unknown1')
            .BzString('skippedIndex')
            .BzIntV('realId')
          )
          .BzString('race', true)
          .BzHash('color', Bz()
            .BzIntV('alpha')
            .BzIntV('red')
            .BzIntV('green')
            .BzIntV('blue')
          )
          .BzIntV('unknown0')
          .BzIntV('team')
          .BzIntV('handicap')
          .BzIntV('unknown1')
          .BzIntV('outcome')
        )
      )
      .BzString('mapName', true)
      .BzString('unknown1')
      .BzHash('mapInfo', Bz()
        .BzString('minimap', true)
      )
      .BzInt8('unknown1')
      .BzIntV('datetime')
      .BzIntV('timezoneOffset')
      .BzString('unknown2')
      .BzString('unknown3')
      .BzString('unknown4')
      .BzArray('mapFiles', Bz()
        .BzString('hash')
      )
      .BzInt8('unknown5')
      .BzIntV('unknown6')
      .BzIntV('unknown7')
    );


var parseDetails = module.exports.parse = function parseDetails(data, version) {
  var emitter = new EventEmitter();

  process.nextTick(function() {
    var result;
    try {
      result = detailsParser.execute(data).details;
    }
    catch(err) {
      return emitter.emit('error', err);
    }

    convertMapHashesToFilenames(result);
    for(var i = 0; i < result.players.length; i++) {
      result.players[i] = result.players[i].details; // remove an unnecessary layer
    }
    emitter.emit('success', result);
  });

  return emitter;
};

function convertMapHashesToFilenames(repDetails) {
  var hexDigits = '0123456789abcdef';

  for(var i = 0; i < repDetails.mapFiles.length; i++) {
    var hashBuffer = repDetails.mapFiles[i].hash;
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
