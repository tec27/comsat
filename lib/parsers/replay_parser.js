// wraps all the various parsers to make the main class a lot cleaner
var util = require('util'),
    fs = require('fs'),
    EventEmitter = require('events').EventEmitter,
    path = require('path'),
    mpyq = require('../mpyq'),
    comsat_util = require('../comsat_util'),
    headerParser = require('./header'),
    detailsParser = require('./details'),
    attributesParser = require('./attributes'),
    messagesParser = require('./messages'),
    actionsParser = require('./actions'),
    Profiler = require('../profiler').Profiler;

function ReplayParser(filename, deleteFile) {
  if(!(this instanceof ReplayParser)) return new ReplayParser(filename, deleteFile);

  this.filename = filename;
  this.deleteFile = deleteFile;

  this.error = null;

  EventEmitter.call(this);
}
util.inherits(ReplayParser, EventEmitter);
exports.ReplayParser = ReplayParser;

ReplayParser.prototype.parse = function() {
  var self = this;
  var prof = new Profiler('mpyq#extractReplay');

  mpyq.extractReplay(this.filename, this.deleteFile)
    .on('error', function(err) {
      self._error(err);
      prof.done();
    })
    .on('extracted', function(extractDir) {
      self.extractDir = extractDir;
      prof.done();
      self._parseReplay();
    });

  return this;
};


ReplayParser.prototype._error = function(err) {
  if(this.error) return;

  this.error = err;
  this.emit('error', err);
};

ReplayParser.prototype._parseReplay = function() {
  var self = this;

  this.sequence = [
    [ 'header' ],
    [ 'details' ],
    [ 'attributes' ],
    [ 'chat', 'actions' ]
  ];
  this.running = 0;

  this._launcher();
};

ReplayParser.prototype._launcher = function() {
  var self = this;
  var items = this.sequence.shift();

  function runFunc(item) {
    var funcName = '_parse' + item[0].toUpperCase() + item.slice(1);
    self[funcName]()
      .on('error', function(err) {
        self.running--;
        self._error(err);
      })
      .on('progress', function(data) {
        if(self.error) return;
        self.emit(item, data);
      })
      .on('success', function(data) {
        self.running--;
        if(self.error) return;

        if (data) self.emit(item, data); // parsers without progress
        else self.emit(item + 'Done'); // parsers with progress

        if(self.sequence.length) self._launcher();
        else if(self.running === 0) self._done();
      });
  }

  while(!this.error && items.length > 0) {
    var item = items.shift();
    runFunc(item);
    this.running++;
  }
};

ReplayParser.prototype._done = function() {
  if(!this.error) this.emit('done');

  comsat_util.rm_rf(this.extractDir, function(err) { if(err) console.log('Error deleting extracted replay directory: ' + err); });
};

ReplayParser.prototype._parseHeader = function() {
  var self = this;
  var emitter = new EventEmitter();
  var prof = new Profiler('ReplayParser#_parseHeader readFile');

  var headerFile = path.join(this.extractDir, 'replay.header');

  fs.readFile(headerFile, function onHeaderRead(err, data) {
    if(err) return emitter.emit('error', err);
    prof.done();

    var parseProf = new Profiler('headerParser#parse');
    headerParser.parse(data)
      .on('error', function(err) {
        emitter.emit('error', err);
      })
      .on('success', function(data) {
        self.version = data.version;
        parseProf.done();
        emitter.emit('success', data);
      });
  });

  return emitter;
};

ReplayParser.prototype._parseDetails = function() {
  var self = this;
  var emitter = new EventEmitter();
  var prof = new Profiler('ReplayParser#_parseDetails readFile');

  var detailsFile = path.join(this.extractDir, 'replay.details');

  fs.readFile(detailsFile, function onDetailsRead(err, data) {
    if(err) return emitter.emit('error', err);
    prof.done();

    var parseProf = new Profiler('detailsParser#parse');
    detailsParser.parse(data, self.version)
      .on('error', function(err) {
        emitter.emit('error', err);
      })
      .on('success', function(data) {
        parseProf.done();
        emitter.emit('success', data);
      });
  });

  return emitter;
};

ReplayParser.prototype._parseAttributes = function() {
  var self = this;
  var emitter = new EventEmitter();
  var prof = new Profiler('ReplayParser#_parseAttributes readFile');

  var attributesFile = path.join(this.extractDir, 'replay.attributes.events');

  fs.readFile(attributesFile, function onAttributesRead(err, data) {
    if(err) return emitter.emit('error', err);
    prof.done();

    var parseProf = new Profiler('attributesParser#parse');
    attributesParser.parse(data, self.version)
      .on('error', function(err) {
        emitter.emit('error', err);
      })
      .on('success', function(data) {
        parseProf.done();
        emitter.emit('success', data);
      });
  });

  return emitter;
};

ReplayParser.prototype._parseChat = function() {
  var self = this;
  var emitter = new EventEmitter();

  var chatFile = path.join(this.extractDir, 'replay.message.events');

  var firstEventProf = new Profiler('chatParser#parse first chat');
  var fullParseProf = new Profiler('chatParser#parse completed');

  var stream = fs.createReadStream(chatFile, { bufferSize: 8*1024 });
  messagesParser.parse(stream, self.version)
    .on('error', function(err) {
      emitter.emit('error', err);
    })
    .on('chat', function(data) {
      if(firstEventProf) {
        firstEventProf.done();
        firstEventProf = null;
      }
      emitter.emit('progress', data);
    })
    .on('success', function() {
      fullParseProf.done();
      emitter.emit('success');
    });

  return emitter;
};

ReplayParser.prototype._parseActions = function() {
  var self = this;
  var emitter = new EventEmitter();

  var actionsFile = path.join(this.extractDir, 'replay.game.events');

  var firstEventProf = new Profiler('actionsParser#parse first action');
  var fullParseProf = new Profiler('actionsParser#parse completed');

  var stream = fs.createReadStream(actionsFile, { bufferSize: 8*1024 });
  actionsParser.parse(stream, self.version)
    .on('error', function(err) {
      emitter.emit('error', err);
    })
    .on('actions', function(data) {
      if(firstEventProf) {
        firstEventProf.done();
        firstEventProf = null;
      }
      emitter.emit('progress', data);
    })
    .on('success', function() {
      fullParseProf.done();
      emitter.emit('success');
    });

  //process.nextTick(function() { emitter.emit('success'); });
  return emitter;
};

