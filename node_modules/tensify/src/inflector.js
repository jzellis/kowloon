var PresentVerbInflector = require('natural').PresentVerbInflector,
    find_irregular_verb = require('./verbs'),
    symbols = require('symbols');

var present_inflector = new PresentVerbInflector();

// Pretty silly :D
// dict of verbs which have stress at not at the end
var stress_dict = ['inherit', 'target', 'visit', 'trigger'];

var stress_at_the_end_of_the_word = function(word) {
	return stress_dict.indexOf(word) === -1;
};

var ends_with_a_single_vowel_plus_a_consonant_and_not_wx = function(verb) {
	var last = verb.length - 1;

	return symbols.is_consonant(verb[last])
		&& symbols.is_vowel(verb[last - 1])
		&& !symbols.is_vowel(verb[last - 2])
		&& verb[last] !== 'w'
		&& verb[last] !== 'x';
};

var ends_with_c = function(verb) {
	return verb[verb.length - 1].toLowerCase() === 'c';
};

var ends_with_consonant_plus_y = function(verb) {
	var last = verb.length - 1;
	return verb[last].toLowerCase() === 'y'
		&& symbols.is_consonant(verb[last - 1]);
};

var ends_with_e = function(verb) {
	return verb[verb.length - 1].toLowerCase() === 'e';
};

var ends_with_two_vowels_plus_a_consonant = function(verb) {
	var last = verb.length - 1;

	return symbols.is_consonant(verb[last])
		&& symbols.is_vowel(verb[last - 1])
		&& symbols.is_vowel(verb[last - 2]);
};

var edded = [
	'embed'
];

var already_in_past = function(verb) {
	return verb.slice(-2) === 'ed'
		&& edded.indexOf(verb) === -1;
};

var edify = function(verb) {
	switch (true) {
		case already_in_past(verb):
			return verb;

		case ends_with_c(verb):
			return verb + 'ked';

		case ends_with_consonant_plus_y(verb):
			return verb.slice(0, -1) + 'ied';

		case ends_with_e(verb):
			return verb + 'd';

		case ends_with_two_vowels_plus_a_consonant(verb):
			return verb + 'ed';

		case ends_with_a_single_vowel_plus_a_consonant_and_not_wx(verb) && stress_at_the_end_of_the_word(verb):
			return verb + verb[verb.length - 1] + 'ed';

		default:
			return verb + 'ed';
	}
};

var tensify = function(verb) {
	var past, past_participle;

	// Normalize verb to simple plural form
	verb = present_inflector.pluralize(verb)

	// Attempt to find irregular verb
	var irregular = find_irregular_verb(verb);

	if (irregular) {
		past = irregular[0];
		past_participle = irregular[1];
	} else {
		past = past_participle = edify(verb);
	}

	return {
		past: past,
		past_participle: past_participle
	};
};

module.exports = tensify;
