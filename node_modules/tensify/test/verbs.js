var find = require('../src/verbs');

describe('Irregular verbs finder', function() {
	it('Should find proper verb set for present tense verb', function() {
		find('weep').should.be.eql(['wept', 'wept']);
		find('teach').should.be.eql(['taught', 'taught']);
		find('smite').should.be.eql(['smote', 'smitten']);
	});
});
