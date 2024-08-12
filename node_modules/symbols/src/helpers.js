var vowels = 'eyuioa';
module.exports.is_vowel = function(sym) {
	return vowels.indexOf(sym.toLowerCase()) !== -1;
};

var consonants = 'qwrtpsdfghjklmnbvcxz';
module.exports.is_consonant = function(sym) {
	return consonants.indexOf(sym.toLowerCase()) !== -1;
};

var brackets = '{}()[]<>';
module.exports.is_bracket = function(sym) {
	return brackets.indexOf(sym.toLowerCase()) !== -1;
};

var open_brackets = '{([<';
module.exports.is_open_bracket = function(sym) {
	return open_brackets.indexOf(sym.toLowerCase()) !== -1;
};

var close_brackets = '})]>';
module.exports.is_close_bracket = function(sym) {
	return close_brackets.indexOf(sym.toLowerCase()) !== -1;
};

var digits = '0123456789';
module.exports.is_digit = function(sym) {
	return digits.indexOf(sym.toLowerCase()) !== -1;
};

var punctuations = ',.!;:-?';
module.exports.is_punctuation = function(sym) {
	return punctuations.indexOf(sym.toLowerCase()) !== -1;
};
