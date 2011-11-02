var path = require('path')
  , async = require('async')
  , fs = require('fs')

module.exports.rm_rf = function(dirpath, callback) {
  callback = callback || function () {};

  fs.readdir(dirpath, function(err, files) {
    var tasks = [];
    for(var i = 0; i < files.length; i++)
    {
      tasks.push(async.apply(fs.unlink, path.join(dirpath, files[i])));
    }

    async.parallel(tasks, function(err, results) {
      if(err) callback(err);
      else fs.rmdir(dirpath, callback);
    });
  });
}


module.exports.generateRandomFilename = function() {
  var name = '';
  for (var i = 0; i < 32; i++) {
    name += Math.floor(Math.random() * 16).toString(16);
  }

  return name;
}
