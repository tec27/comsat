var comsat = require('comsat')
  , path = require('path')
  , vows = require('vows')
  , should = require('./vows-should')(require('should'))
  , util = require('util')
  , fs = require('fs')
  , comsat_util = require('comsat_util')

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

function repPath(name) {
  return path.join(fixturesDir, name);
}
// END UTILITY FUNCTIONS

vows.describe('comsat integration tests').addBatch({
  'Loading an invalid file': {
    topic: function() { comsat.loadReplay('/my/test/path', false, this.callback).on('error', function() {}); },

    'should give an error': function(err, rep) {
      should.exist(err);
    },
  },
  'Loading a valid file': {
    topic: function() { comsat.loadReplay(repPath('4v4.SC2Replay'), false, this.callback) },

    'should not give an error': function(err, rep) {
      should.not.exist(err);
    },
    'should give a Replay object that': {
      topic: function(rep) { return rep; },

      'is not null': function(rep) {
        should.exist(rep);
      },
      'has all data properties set': function(rep) {
        rep.should.have.property('info');
        rep.should.have.property('players');
        rep.should.have.property('map');
        rep.should.have.property('messages');
        rep.should.have.property('actions');
      },
      'has an info property that': {
        topic: function(rep) { return rep.info },

        'has the correct game version': function(info) {
          info.should.have.property('version');
          info.version.should.have.property('major').eql(1);
          info.version.should.have.property('minor').eql(4);
          info.version.should.have.property('patch').eql(1);
          info.version.should.have.property('build').eql(19776);
        },
        'has the correct game length': function(info) {
          info.should.have.property('gameLength');
          info.gameLength.should.eql(14419);
        },
        'has the correct region': function(info) {
          info.should.have.property('region').eql('US');
        },
        'has the correct date': function(info) {
          info.should.have.property('date');
          info.date.should.have.property('value').eql(1318302653);
          info.date.should.have.property('timezoneOffset').eql(-14400);
          (info.date.value + info.date.timezoneOffset).should.eql(1318288253);
        },
        'has the correct game format': function(info) {
          info.should.have.property('format').eql('4v4');
        },
        'has the correct game speed': function(info) {
          info.should.have.property('speed').eql('Faster');
        },
        'has the correct number of players': function(info) {
          info.should.have.property('numPlayers').eql(8);
        },
        'has the correct number of teams': function(info) {
          info.should.have.property('teams');
          should.exist(info.teams);
          info.teams.should.have.lengthOf(2);
        },
        'has the correct team members': function(info) {
          should.exist(info.teams);

          var team0 = [ 'JetH', 'labi', 'Rhythm', 'Renato' ];
          var team1 = [ 'tectwoseven', 'Milkis', 'Fedora', 'skindzer' ];

          for(var i = 0; i < info.teams[0].length; i++) {
            var player = info.teams[0][i];
            team0.should.contain(player.name);
          }

          for(var i = 0; i < info.teams[1].length; i++) {
            var player = info.teams[1][i];
            team1.should.contain(player.name);
          }

          team0.length.should.eql(info.teams[0].length);
          team1.length.should.eql(info.teams[1].length);
        },
        'has the correct game type': function(info) {
          info.should.have.property('gameType').eql('AutoMM');
        },
        'has the correct recorder': function(info) {
          info.should.have.property('recordedBy').with.property('name').eql('tectwoseven');
        },
        'can convert the game length to seconds correctly': function(info) {
          info.should.respondTo('gameLengthInSeconds');
          info.gameLengthInSeconds().should.eql(653);
        },
      }, // has info property that
      'has a players property that': {
        topic: function(rep) { return rep.players; },

        'is an array': function(players) {
          players.should.be.an.instanceof(Array);
        },
        'contains Player objects': function(players) {
          players[0].should.be.an.instanceof(comsat.Player);
        },
        'has correct player ordering': function(players) {
          players[0].name.should.eql('JetH');
          players[1].name.should.eql('labi');
          players[2].name.should.eql('Rhythm');
          players[3].name.should.eql('Renato');
          players[4].name.should.eql('Milkis');
          players[5].name.should.eql('Fedora');
          players[6].name.should.eql('tectwoseven');
          players[7].name.should.eql('skindzer');
        },
        'has correct outcomes': function(players) {
          players[0].isWinner().should.eql(true);
          players[1].isWinner().should.eql(true);
          players[2].isWinner().should.eql(true);
          players[3].isWinner().should.eql(true);
          players[4].isLoser().should.eql(true);
          players[5].isLoser().should.eql(true);
          players[6].isLoser().should.eql(true);
          players[7].isLoser().should.eql(true);
        },
        'has correct color objects': function(players) {
          players[6].color.should.have.property('argb');
          players[6].color.argb.alpha.should.eql(255);
          players[6].color.argb.red.should.eql(22);
          players[6].color.argb.green.should.eql(128);
          players[6].color.argb.blue.should.eql(0);
          players[6].color.should.have.property('name');
          players[6].color.name.should.eql('Green');
        },
        'has correct race objects': function(players) {
          players[6].race.should.have.property('value').eql('Zerg');
          players[6].race.should.have.property('random').eql(true);
          players[0].race.should.have.property('value').eql('Protoss');
          players[0].race.should.have.property('random').eql(false);
        },
        'has correct teams': function(players) {
          players[0].team.should.eql(0);
          players[1].team.should.eql(0);
          players[2].team.should.eql(0);
          players[3].team.should.eql(0);
          players[4].team.should.eql(1);
          players[5].team.should.eql(1);
          players[6].team.should.eql(1);
          players[7].team.should.eql(1);
        },
        'has correct player type': function(players) {
          players[7].playerType.should.eql('Human');
        },
        'has correct player difficulty': function(players) {
          players[7].difficulty.should.eql('Medium');
        },
        'has correct handicap': function(players) {
          players[7].handicap.should.eql(100);
        }
      }, // has a players property that
    } // should give a Replay object that
  }, // Loading a valid file
  'Loading a valid file with deletion': {
    topic: function() { 
      var origFile = repPath('4v4.SC2Replay');
      var newFile = path.join('/tmp', comsat_util.generateRandomFilename());
      var self = this;
      copyFile(origFile, newFile, function(err) {
        if(err) {
          return err;
        }

        comsat.loadReplay(newFile, true, self.callback);
      });
    },

    'should not give an error': function(err, rep) {
      should.not.exist(err);
    },
    'should give a non-null Replay object': function(err, rep) {
      should.exist(rep);
    },
    'should delete the file': function(err, rep) {
      path.exists(rep.filename, function(exists) {
        exists.should.be.false;
      });
    },
  }
}).export(module);
