var EventEmitter = require('events').EventEmitter,
    Buffers = require('buffers');

var parseMessages = module.exports.parse = function parseMessages(stream, version) {
  var emitter = new EventEmitter(),
      buffers = Buffers(),
      errored = false,
      currentFrame = 0;

  function onData() {
    var data = buffers.toBuffer();
    var messages = [ ];
    try {
      var event;
      while(event = parseEvent(data)) {
        data = data.slice(event.size);
        var val = event.value;
        currentFrame += val.frameDelta;
        messages.push({ frame: currentFrame,
                        playerId: val.playerId,
                        flags: val.flags,
                        payload: val.payload
                      });
      }

      buffers = Buffers();
      if(data.length) buffers.push(data);

      messages.length && emitter.emit('chat', messages);
    }
    catch(err) {
      !errored && emitter.emit('error', err);
      errored = true;
    }
  }

  stream
    .on('data', function(data) {
      if(errored) return;
      buffers.push(data);
      onData();
    })
    .on('error', function(err) {
      !errored && emitter.emit('error', err);
      errored = true;
    })
    .on('end', function() {
      if(!errored && !buffers.toBuffer().length) emitter.emit('success');
      else if(!errored) emitter.emit('error', new Error('Leftover data in chat message buffer'));
    });

  return emitter;
}

function parseEvent(data) {
  var size = 0;
  var value = { };

  var timestampRet = parseTimestamp(data);
  if(!timestampRet) return false;
  value.frameDelta = timestampRet.value;
  size += timestampRet.size;
  data = data.slice(timestampRet.size);

  if(!data.length) return false;
  value.playerId = data[0] & 0x0F;
  size++;
  data = data.slice(1);

  if(!data.length) return false;
  value.flags = data[0];
  size++;
  data = data.slice(1);

  if(value.flags == 0x83) {
    var parseRet = parseUnknown8Event(data);
    if(!parseRet) return false;
    size += parseRet.size;
    value.payload = parseRet.value;
  }
  else if(value.flags == 0x80) {
    var parseRet = parseUnknown4Event(data);
    if(!parseRet) return false;
    size += parseRet.size;
    value.payload = parseRet.value;
  }
  else if((value.flags & 0x80) == 0) {
    var parseRet = parseChatEvent(data, value.flags);
    if(!parseRet) return false;
    size += parseRet.size;
    value.payload = parseRet.value;
  }

  return { value: value, size: size };
}

function parseTimestamp(data) {
  if(data.length == 0) return false;
  var size = (data[0] & 3) + 1;
  if(data.length < size) return false;
  var value = data[0] >>> 2;
  for(var i = 1; i < size; i++) {
    value = (value << 8) + data[i];
  }

  return { value: value, size: size };
}

function parseUnknown8Event(data) {
  var size = 8;
  if(data.length < size) return false;
  var value = [ ];
  for(var i = 0; i < 8; i++) {
    value[i] = data[i];
  }

  return { value: value, size: size };
}

function parseUnknown4Event(data) {
  var size = 4;
  if(data.length < size) return false;
  var value = [ ];
  for(var i = 0; i < 4; i++) {
    value[i] = data[i];
  }

  return { value: value, size: size };
}

function parseChatEvent(data, flags) {
  var size = 1;
  if(data.length < size) return false;
  var value = { };

  value.channel = flags & 3;

  var length = data[0];
  if(flags & 0x08) length += 64;
  if(flags & 0x10) length += 128;

  value.message = data.toString('utf8', 1, length+1);
  size += length;
  return { value: value, size: size };
}
