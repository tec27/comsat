var path = require('path')
    , child_process = require('child_process')
    , blizzerial = require('./blizzerial')
    , mpyq = require('../mpyq')
    , comsat_util = require('../comsat_util')

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


var parseDetails = module.exports.parse = function parseDetails(err, data, callback) {
	if(err) callback(err, null);

	var details = blizzerial.parse(data, detailsMap);
	convertMapHashesToFilenames(details);
	//console.log("Mapped details to object:");
	//console.log(util.inspect(details, false, null));
	
	var mapFileName = details.mapFiles[4].filename;
	var mapImagePath = path.join(process.cwd(), 'public/images/', mapFileName + '.jpg');
	// TODO: move this stuff out of here and do it at a different point in the process
	path.exists(mapImagePath, function(exists) {
		if(!exists) {
			//console.log("Map thumbnail file did not exist, attempting to download from depot.battle.net!");
			mpyq.downloadMap(details.mapFiles[4].region, mapFileName, function(err, dlPath) {
				if(err) {
					console.log("Error downloading map: " + err);
					callback(null, details);
				}

				mpyq.extractMap(dlPath, details.mapInfo.minimap, true, function(err, extractPath) {
					if(err) {
						console.log("Error extracting map: " + err);
						callback(null, details);
					}
					child_process.exec('convert ' + path.join(extractPath, details.mapInfo.minimap) + ' ' + mapImagePath, function(error, stdout, stderr) {
						callback(null, details);
						comsat_util.rm_rf(extractPath, function(err) { if(err) console.log("Error deleting extracted map directory: " + err); });
					});
				});
			})
		}
		else
			callback(null, details);
	});
}

function convertMapHashesToFilenames(repDetails) {
	var hexDigits = '0123456789abcdef';
	
	for(var i = 0; i < repDetails.mapFiles.length; i++) {
		var hashBuffer = repDetails.mapFiles[i];
		var str_s2ma = hashBuffer.toString('utf8', 0, 4);
		if(str_s2ma !== 's2ma')
			throw new Error('start of map hash ' + i + ' did not equal "s2ma"');
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
