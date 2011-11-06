## comsat
_comsat_ is a [node.js](http://nodejs.org) library for parsing Starcraft 2 replay files.

The library utilizes [mpyq](https://github.com/iamteem/mpyq) for replay extraction, with parsing all done through javascript.

## Usage

### simple
This code will print a listing of the player slots in this replay. You can do a lot more with comsat, however, see the source, tests and/or `util.inspect` for examples of the kind of data you can pull out (eventually I will have a list here of members for each of the properties on the Replay objects).

    var comsat = require('comsat');
    comsat.loadReplay('/path/to/replay.SC2Replay', false /* deleteFile (true means delete the replay file after parsing */, function(err, rep) {
        if(err) throw err;

        for(var i = 0; i < rep.players.length; i++) {
            if(rep.players[i]) {
                console.log(rep.players[i].name, ' - ', rep.players[i].race.value);
            }
            else {
                console.log('Open');
            }
        }
    });

## Installation
_comsat_ uses [mpyq](https://github.com/iamteem/mpyq) for extracting and decompressing replays and map files, so you'll need both **python** and **mpyq**.

You may also need to install some additional dependencies for [node-bigint](https://github.com/substack/node-bigint). See the install guide for more details.

To install _comsat_ itself, use [npm](http://npmjs.org/)

    npm install comsat

## Testing
To run the tests, simply run:

    npm test
