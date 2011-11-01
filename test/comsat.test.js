var Replay = require('comsat')
    , path = require('path')
    , should = require('should')
    , util = require('util')
    , fs = require('fs')
    ;

var fixturesDir = path.join(__dirname, 'fixtures');

// UTILITY FUNCTIONS
function copyFile(src, dst, callback) {
    callback = callback || function() { };

    os = fs.createWriteStream(dst);
    is = fs.createReadStream(src);

    os.once('open', function(fd) {
        util.pump(is,os, callback);
    });
}

function generateRandomFilename() {
	var name = '';
	for (var i = 0; i < 32; i++) {
		name += Math.floor(Math.random() * 16).toString(16);
	}

	return name;
}
// END UTILITY FUNCTIONS

module.exports = {
    'constructor should set filename': function() {
        var rep = new Replay('/my/test/path');

        rep.should.have.property('filename');
        rep.filename.should.equal('/my/test/path');
    },

    'invalid file should return error': function() {
        var rep = new Replay('/my/test/path');
        rep.load(false, function(err) {
            should.exist(err);
        });
    },

    'valid file should not return error': function() {
        var rep = new Replay(path.join(fixturesDir, '4v4.SC2Replay'));
        rep.load(false, function(err) {
            should.not.exist(err);
        });
    },

    'deleteFile should mean the replay gets deleted': function() {
        var origFile = path.join(fixturesDir, '4v4.SC2Replay');
        var newFile = path.join('/tmp', generateRandomFilename());
        copyFile(origFile, newFile, function(err) {
            if(err)
                should.fail('Copying replay to new location for testing failed.');
            else {
                var rep = new Replay(newFile);
                rep.load(true, function(err) {
                    path.exists(newFile, function(exists) {
                        exists.should.be.false;
                    });
                });
            }
        });
    },

    'loaded replay should have all data properties set': function() {
        var rep = new Replay(path.join(fixturesDir, '4v4.SC2Replay'));
        rep.load(false, function(err) {
            rep.should.have.property('info');
            rep.should.have.property('players');
            rep.should.have.property('map');
            rep.should.have.property('messages');
            rep.should.have.property('actions');
        });
    },

    'info should have correct game version': function() {
        var rep = new Replay(path.join(fixturesDir, '4v4.SC2Replay'));
        rep.load(false, function(err) {
            rep.info.should.have.property('version');
            rep.info.version.should.have.property('major').eql(1);
            rep.info.version.should.have.property('minor').eql(4);
            rep.info.version.should.have.property('patch').eql(1);
            rep.info.version.should.have.property('build').eql(19776);
        });
    },

    'info should have correct game length': function() {
        var rep = new Replay(path.join(fixturesDir, '4v4.SC2Replay'));
        rep.load(false, function(err) {
            rep.info.should.have.property('gameLength');
            rep.info.gameLength.should.eql(14419);
        });
    },

    'info should have correct region': function() {
        var rep = new Replay(path.join(fixturesDir, '4v4.SC2Replay'));
        rep.load(false, function(err) {
            rep.info.should.have.property('region').eql('US');
        });
    },

    'info should have correct date': function() {
        var rep = new Replay(path.join(fixturesDir, '4v4.SC2Replay'));
        rep.load(false, function(err) {
            rep.info.should.have.property('date');
            rep.info.date.should.have.property('value').eql(1318302653);
            rep.info.date.should.have.property('timezoneOffset').eql(-14400);
            (rep.info.date.value + rep.info.date.timezoneOffset).should.eql(1318288253);
        });
    },

    'info should have correct game format': function() {
        var rep = new Replay(path.join(fixturesDir, '4v4.SC2Replay'));
        rep.load(false, function(err) {
            rep.info.should.have.property('format').eql('4v4');
        });
    },

    'info should have correct game speed': function() {
        var rep = new Replay(path.join(fixturesDir, '4v4.SC2Replay'));
        rep.load(false, function(err) {
            rep.info.should.have.property('speed').eql('Faster');
        });
    },

    'info should have correct number of teams': function() {
        var rep = new Replay(path.join(fixturesDir, '4v4.SC2Replay'));
        rep.load(false, function(err) {
            rep.info.should.have.property('teams').with.lengthOf(2);
        });
    },

    'info should have correct team members': function() {
        var rep = new Replay(path.join(fixturesDir, '4v4.SC2Replay'));
        rep.load(false, function(err) {
            var team0 = [ 'JetH', 'labi', 'Rhythm', 'Renato' ];
            var team1 = [ 'tectwoseven', 'Milkis', 'Fedora', 'skindzer' ];

            for(var i = 0; i < rep.info.teams[0].length; i++) {
                var player = rep.info.teams[0][i];
                team0.should.contain(player.name);
            }

            for(var i = 0; i < rep.info.teams[1].length; i++) {
                var player = rep.info.teams[1][i];
                team1.should.contain(player.name);
            }

            team0.length.should.eql(rep.info.teams[0].length);
            team1.length.should.eql(rep.info.teams[1].length);
        });
    },

    'info should have correct game type': function() {
        var rep = new Replay(path.join(fixturesDir, '4v4.SC2Replay'));
        rep.load(false, function(err) {
            rep.info.should.have.property('gameType').eql('AutoMM');
        });
    },

    'info should have correct recorded by': function() {
        var rep = new Replay(path.join(fixturesDir, '4v4.SC2Replay'));
        rep.load(false, function(err) {
            rep.info.should.have.property('recordedBy').eql('tectwoseven');
        });
    },

    'info should return the correct game length seconds conversion': function() {
        var rep = new Replay(path.join(fixturesDir, '4v4.SC2Replay'));
        rep.load(false, function(err) {
            rep.info.should.respondTo('gameLengthInSeconds');
            rep.info.gameLengthInSeconds().should.eql(653);
        });
    },
};
