## String/symbols related helpers [![Build Status](https://travis-ci.org/boo1ean/symbols.png?branch=master)](https://travis-ci.org/boo1ean/symbols)

Set of symbol-related helpers

## Installation

	npm install symbols

## Helpers

```javascript
var symbols = require('symbols');

// eyuioa
symbols.is_vowel(sym);

// qwrtpasdfghjklmnbvcxz
symbols.is_consonant(sym);

// {}()[]<>
symbols.is_bracket(sym);

// {([<
symbols.is_open_bracket(sym);

// })]>
symbols.is_close_bracket(sym);

// 0123456789
symbols.is_digit(sym);

// ,.!;:-?
symbols.is_punctuation(sym);
```

## License

MIT
