var path = require('path')
    , child_process = require('child_process')
    , fs = require('fs')
    , comsat_util = require('./comsat_util')

var extractReplay = module.exports.extractReplay = function extractReplay(filename, deleteFile, callback) {
	// TODO: enable passing output directory as parameter
	var replayExtractPath = path.join('/tmp', comsat_util.generateRandomFilename());
	var mpyq = child_process.spawn('python', [__dirname + '/mpyq/extract_replay.py', filename, replayExtractPath]);
	mpyq.stderr.on('data', function(data) {
		//console.log('mpyq stderr: %s', data);
	});
	mpyq.on('exit', function(code) {
		if(code != 0) {
			callback('mpyq exited with error code: ' + code);
			return;
		}
		if(deleteFile) {
			fs.unlink(filename, function(err) {
				//if(err)
				//	console.log('Error deleting %s: %s', filename, err);
				//else
				//	console.log('Successfully deleted %s', filename);
			});
		}
		callback(null, replayExtractPath);
	});
}

var downloadMap = module.exports.downloadMap = function downloadMap(region, hash, callback) {
	var url = 'http://' + region.toLowerCase() + '.depot.battle.net:1119';
	url += '/' + hash + '.s2ma';
	var localFile = path.join('/tmp', hash);
	var curlCommand = 'curl -sL -w "%{http_code}\\\\n" -o ' + localFile + ' ' + url;
	child_process.exec(curlCommand, function(error, stdout, stderr) {
		if(error || stderr)
			callback('Error downloading map (error: "' + error + '" stderr: "' + stderr + '"', '');
		else
			callback(null, localFile);
	});
}

var extractMap = module.exports.extractMap = function extractMap(filename, minimapFile, deleteFile, callback) {
	// TODO: enable specifying output directories
	var mpyq = child_process.spawn('python', [__dirname + '/mpyq/extract_map.py', filename, minimapFile]);
	mpyq.stderr.on('data', function(data) {
		//console.log('mpyq stderr: %s', data);
	});
	mpyq.on('exit', function(code) {
		if(code != 0) {
			callback('mpyq exited with error code: ' + code, '');
			return;
		}
		if(deleteFile) {
			fs.unlink(filename, function(err) {
				//if(err)
				//	console.log('Error deleting %s: %s', localFile, err);
				//else
				//	console.log('Successfully deleted %s', localFile);
			});
		}
		callback(null, filename + '-extracted');
	});
}
