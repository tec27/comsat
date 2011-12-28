var parseMessages = module.exports.parse = function parseMessages(err, data, version, callback) {
  if(err) {
    callback(err, null);
    return;
  }

  process.nextTick(function onMessagesNextTick() {
    var messages = [ ];
    var currentFrame = 0;
    try {
      while(data.length > 0) {
        var event = parseEvent(data);
        data = data.slice(event.size);
        var val = event.value;
        currentFrame += val.frameDelta;
        messages.push({ frame: currentFrame,
                        playerId: val.playerId,
                        flags: val.flags,
                        payload: val.payload
                      });
        currentFrame += val.frameDelta;
      }
    }
    catch (e) {
      callback(new Error(e));
      return;
    }

    callback(null, messages);
  });
}

function parseEvent(data) {
  var size = 0;
  var value = { };

  var timestampRet = parseTimestamp(data);
  value.frameDelta = timestampRet.value;
  size += timestampRet.size;
  data = data.slice(timestampRet.size);

  value.playerId = data[0] & 0x0F;
  size++;
  data = data.slice(1);

  value.flags = data[0];
  size++;
  data = data.slice(1);

  if(value.flags == 0x83) {
    var parseRet = parseUnknown8Event(data);
    size += parseRet.size;
    value.payload = parseRet.value;
  }
  else if(value.flags == 0x80) {
    var parseRet = parseUnknown4Event(data);
    size += parseRet.size;
    value.payload = parseRet.value;
  }
  else if((value.flags & 0x80) == 0) {
    var parseRet = parseChatEvent(data, value.flags);
    size += parseRet.size;
    value.payload = parseRet.value;
  }

  return { value: value, size: size };
}

function parseTimestamp(data) {
  var size = (data[0] & 3) + 1;
  var value = data[0] >>> 2;
  for(var i = 1; i < size; i++) {
    value = (value << 8) + data[i];
  }

  return { value: value, size: size };
}

function parseUnknown8Event(data) {
  var size = 8;
  var value = [ ];
  for(var i = 0; i < 8; i++) {
    value[i] = data[i];
  }

  return { value: value, size: size };
}

function parseUnknown4Event(data) {
  var size = 4;
  var value = [ ];
  for(var i = 0; i < 4; i++) {
    value[i] = data[i];
  }

  return { value: value, size: size };
}

function parseChatEvent(data, flags) {
  var size = 1;
  var value = { };

  value.channel = flags & 3;

  var length = data[0];
  if(flags & 0x08) length += 64;
  if(flags & 0x10) length += 128;

  value.message = data.toString('utf8', 1, length+1);
  size += length;
  return { value: value, size: size };
}
