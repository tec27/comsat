var path = require('path')
  , child_process = require('child_process')
  , fs = require('fs')
  , comsat_util = require('./comsat_util')
  , EventEmitter = require('events').EventEmitter
  , util = require('util')


module.exports.extractReplay = function(filename, deleteFile) {
  // TODO: enable passing output directory as parameter
  var replayExtractPath = path.join('/tmp', comsat_util.generateRandomFilename());
  var emitter = new EventEmitter();
  var mpyq = child_process.spawn('python', [__dirname + '/mpyq/extract_replay.py', filename, replayExtractPath]);
  mpyq.stderr.on('data', function(data) {
    emitter.emit('error', new Error(data));
  });

  mpyq.on('exit', function(code) {
    if(code != 0)
      return emitter.emit('error', new Error('mpyq exited with error code: ' + code));

    if(deleteFile)
      fs.unlink(filename);

    emitter.emit('extracted', replayExtractPath);
  });

  return emitter;
}


// TODO: rewrite the map stuff as event emitters
module.exports.downloadMap = function (region, hash, callback) {
  var url = 'http://' + region.toLowerCase() + '.depot.battle.net:1119';
  url += '/' + hash + '.s2ma';
  var localFile = path.join('/tmp', hash);
  var curlCommand = 'curl -sL -w "%{http_code}\\\\n" -o ' + localFile + ' ' + url;
  child_process.exec(curlCommand, function(error, stdout, stderr) {
    if(error || stderr)
      callback(new Error('Error downloading map (error: "' + error + '" stderr: "' + stderr + '"'), '');
    else
      callback(null, localFile);
  });
}

module.exports.extractMap = function (filename, minimapFile, deleteFile, callback) {
  // TODO: enable specifying output directories
  var mpyq = child_process.spawn('python', [__dirname + '/mpyq/extract_map.py', filename, minimapFile]);
  mpyq.stderr.on('data', function(data) {
    console.error('mpyq: %s', data);
  });
  mpyq.on('exit', function(code) {
    if(code != 0) {
      callback(new Error('mpyq exited with error code: ' + code), '');
      return;
    }
    if(deleteFile) {
      fs.unlink(filename, function(err) {
        //if(err)
        //  console.log('Error deleting %s: %s', localFile, err);
        //else
        //  console.log('Successfully deleted %s', localFile);
      });
    }
    callback(null, filename + '-extracted');
  });
}

module.exports.getMapThumbnail = function(imagePath, mapFilename, minimapFilename, region, callback) {
  process.nextTick(function() {
    path.exists(imagePath, function(exists) {
      if(!exists) {
        module.exports.downloadMap(region.toLowerCase(), mapFilename, function(err, dlPath) { onDownloadedMap(err, dlPath, callback) });
      }
    });
  });
}

function onDownloadedMap(err, dlPath, callback) {
  if(err) {
    callback(err);
    return;
  }

  module.exports.extractMap(dlPath, minimapFilename, true, function(err, extractPath) { onExtractedMap(err, extractPath, callback); });
}

function onExtractedMap(err, extractPath, callback) {
  if(err) {
    callback(err);
    comsat_util.rm_rf(extractPath, function(err) { if(err) console.log("Error deleting extracted map directory: " + err); });
    return;
  }

  child_process.exec('convert ' + path.join(extractPath, minimapFilename) + ' ' + imagePath, function(err, stdout, stderr) {
    if(err) {
      callback(err);
      comsat_util.rm_rf(extractPath, function(err) { if(err) console.log("Error deleting extracted map directory: " + err); });
      return;
    }

    callback();
  });
}
