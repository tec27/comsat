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
    messagesParser = require('./messages');

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
  mpyq.extractReplay(this.filename, this.deleteFile)
    .on('error', function(err) {
      self._error(err);
    })
    .on('extracted', function(extractDir) {
      self.extractDir = extractDir;
      self._parseReplay();
    });

  return this;
}


ReplayParser.prototype._error = function(err) {
  if(this.error) return;

  this.error = err;
  this.emit('error', err);
}

ReplayParser.prototype._parseReplay = function() {
  var self = this;

  this.sequence = [
    [ 'header' ],
    [ 'details', 'attributes' ],
    [ 'chat', 'actions' ]
  ];
  this.running = 0;

  this._launcher();
}

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
      .on('success', function(data) {
        self.running--;
        if(!self.error)
          self.emit(item, data)

        if(self.sequence.length) self._launcher();
        else if(self.running == 0) self._done();
      });
  }

  while(!this.error && items.length > 0) {
    var item = items.shift();
    runFunc(item);
    this.running++;
  }
}

ReplayParser.prototype._done = function() {
  if(!this.error) this.emit('done');

  comsat_util.rm_rf(this.extractDir, function(err) { if(err) console.log('Error deleting extracted replay directory: ' + err); });
}

ReplayParser.prototype._parseHeader = function() {
  var self = this;
  var emitter = new EventEmitter();

  var headerFile = path.join(this.extractDir, 'replay.header');

  fs.readFile(headerFile, function onHeaderRead(err, data) {
    if(err) return emitter.emit('error', err);

    headerParser.parse(data)
      .on('error', function(err) {
        emitter.emit('error', err);
      })
      .on('success', function(data) {
        self.version = data.header && data.header.version;
        emitter.emit('success', data);
      });
  });

  return emitter;
}

ReplayParser.prototype._parseDetails = function() {
  var self = this;
  var emitter = new EventEmitter();

  var detailsFile = path.join(this.extractDir, 'replay.details');

  fs.readFile(detailsFile, function onDetailsRead(err, data) {
    if(err) return emitter.emit('error', err);

    detailsParser.parse(data, self.version)
      .on('error', function(err) {
        emitter.emit('error', err);
      })
      .on('success', function(data) {
        emitter.emit('success', data);
      });
  });

  return emitter;
}

ReplayParser.prototype._parseAttributes = function() {
  var self = this;
  var emitter = new EventEmitter();

  var attributesFile = path.join(this.extractDir, 'replay.attributes.events');

  fs.readFile(attributesFile, function onAttributesRead(err, data) {
    if(err) return emitter.emit('error', err);

    attributesParser.parse(data, self.version)
      .on('error', function(err) {
        emitter.emit('error', err);
      })
      .on('success', function(data) {
        emitter.emit('success', data);
      });
  });

  return emitter;
}

ReplayParser.prototype._parseChat = function() {
  var self = this;
  var emitter = new EventEmitter();
  // TODO
  process.nextTick(function() { emitter.emit('success', []); });
  return emitter;
}

ReplayParser.prototype._parseActions = function() {
  var self = this;
  var emitter = new EventEmitter();
  // TODO
  process.nextTick(function() { emitter.emit('success', []); });
  return emitter;
}
