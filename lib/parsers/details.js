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
    result.players = result.players.map(function(player) {
      return player.details; // remove an unnecessary layer
    });

    emitter.emit('success', result);
  });

  return emitter;
};

function convertMapHashesToFilenames(repDetails) {
  repDetails.mapFiles = repDetails.mapFiles.map(function(entry) {
    return {
      region: entry.hash.toString('utf8', 6, 8),
      filename: entry.hash.toString('hex', 8)
    };
  });
}
