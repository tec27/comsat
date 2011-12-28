var parseGameEvents = module.exports.parse = function parseGameEvents(err, data, version, callback) {
  if(err) {
    callback(err, null);
    return;
  }

  // TODO: can we use a stream-like interface to get quicker access to events here?
  // TODO: probably at least need to use a readStream rather than trying to read the whole file at once

  process.nextTick(function onGameEventsNextTick() {
    var gameEvents = [ ];
    var currentFrame = 0;
    try {
      
    }
    catch(e) {
      callback(new Error(e));
      return;
    }

    callback(null, gameEvents);
  });
}
