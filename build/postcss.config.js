"use strict";

var _tailwindcss = _interopRequireDefault(require("tailwindcss"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
module.exports = {
  plugins: ["postcss-preset-env", _tailwindcss["default"]]
};