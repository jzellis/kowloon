var tensify = require('../');

describe('Inflector', function() {
	describe('Regular verbs inflection', function() {
		it('Should handle ends_with_a_single_vowel_plus_a_consonant', function() {
			tensify('admit').past.should.be.equal('admitted');
			tensify('commit').past.should.be.equal('committed');
			tensify('refer').past.should.be.equal('referred');
			tensify('inherit').past.should.be.equal('inherited');
			tensify('target').past.should.be.equal('targeted');
			tensify('visit').past.should.be.equal('visited');
			tensify('stop').past.should.be.equal('stopped');
			tensify('tap').past.should.be.equal('tapped');
			tensify('sob').past.should.be.equal('sobbed');
			tensify('embed').past.should.be.equal('embedded');
			tensify('trigger').past.should.be.equal('triggered');
			tensify('spray').past.should.be.equal('sprayed');
			tensify('display').past.should.be.equal('displayed');
		});

		it('Should handle ends_with_c', function() {
			tensify('picnic').past.should.be.equal('picnicked');
			tensify('mimic').past.should.be.equal('mimicked');
			tensify('traffic').past.should.be.equal('trafficked');
		});

		it('Should handle ends_with_y', function() {
			tensify('try').past.should.be.equal('tried');
		});

		it('Should handle ends_with_e', function() {
			tensify('smile').past.should.be.equal('smiled');
		});

		it('Should handle regular cases', function() {
			tensify('treat').past.should.be.equal('treated');
			tensify('wheel').past.should.be.equal('wheeled');
			tensify('pour').past.should.be.equal('poured');
			tensify('fix').past.should.be.equal('fixed');
			tensify('mix').past.should.be.equal('mixed');
			tensify('boil').past.should.be.equal('boiled');
			tensify('fill').past.should.be.equal('filled');
			tensify('hand').past.should.be.equal('handed');
			tensify('show').past.should.be.equal('showed');
		});
	});

	describe('Irregular verbs inflection', function() {
		it('Should return correct past tense form of irregular verbs', function() {
			tensify('bend').past.should.be.equal('bent');
			tensify('beset').past.should.be.equal('beset');
			tensify('bet').past.should.be.equal('bet');
			tensify('bid').past.should.be.equal('bid');
			tensify('bind').past.should.be.equal('bound');
			tensify('bite').past.should.be.equal('bit');
			tensify('bleed').past.should.be.equal('bled');
			tensify('blow').past.should.be.equal('blew');
			tensify('break').past.should.be.equal('broke');
			tensify('breed').past.should.be.equal('bred');
			tensify('bring').past.should.be.equal('brought');
			tensify('broadcast').past.should.be.equal('broadcast');
			tensify('build').past.should.be.equal('built');
			tensify('burn').past.should.be.equal('burned');
		});
	});

	describe('Alreay past verbs', function() {
		it('Should not be changed', function() {
			tensify('fixed').past.should.be.equal('fixed');
			tensify('mixed').past.should.be.equal('mixed');
			tensify('compiled').past.should.be.equal('compiled');
			tensify('stored').past.should.be.equal('stored');
			tensify('did').past.should.be.equal('did');
			tensify('done').past.should.be.equal('did');
		});
	});
});
