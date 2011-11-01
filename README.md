## comsat
_comsat_ is a [node.js](http://nodejs.org) library for parsing Starcraft 2 replay files.

The library utilizes [mpyq](https://github.com/iamteem/mpyq) for replay extraction, and the parsing is all done through javascript.

## Usage

###simple

    var Replay = require('comsat');
    var rep = new Replay('/path/to/replay.SC2Replay');
    rep.load(false /* deleteFile (true means delete the replay file after parsing */, function(err) {
        if(err) throw err;

        console.log("Replay has %d players", rep.players.length);
    });

## Installation
_comsat_ uses [mpyq](https://github.com/iamteem/mpyq) for extracting and decompressing replays and map files, so you'll need both **python** and **mpyq**.

To install _comsat_ itself, use [npm](http://npmjs.org/):
    npm install comsat
    ^^^^ this will not work yet, I will get this onto npm soon

