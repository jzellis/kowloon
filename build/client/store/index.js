"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _toolkit = require("@reduxjs/toolkit");
var _settings = _interopRequireDefault(require("./settings"));
var _user = _interopRequireDefault(require("./user"));
var _ui = _interopRequireDefault(require("./ui"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
var _default = (0, _toolkit.configureStore)({
  reducer: {
    settings: _settings["default"],
    user: _user["default"],
    ui: _ui["default"]
  }
});
exports["default"] = _default;