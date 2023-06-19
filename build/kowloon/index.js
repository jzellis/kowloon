"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
var _url = require("url");
var _redis = require("redis");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
var _filename = (0, _url.fileURLToPath)(import.meta.url);
var _dirname = _path["default"].dirname(_filename);
var methodDir = _dirname + "/methods/";

// Object.prototype.defineMethod = function (methodName, methodBody) {
//   Object.defineProperty(this, methodName, {
//     enumerable: true,
//     configurable: true,
//     value: methodBody,
//   });
// };

var Kowloon = {
  settings: {},
  connection: {},
  user: null,
  actor: null,
  owner: null,
  target: null,
  subject: null,
  sanitizedFields: "-owner -_id -__v -_kowloon -bto -bcc -password",
  testing: true,
  redis: null
};
var verbs = await _fs["default"].readdirSync(methodDir);
for (var j = 0; j < verbs.length; j++) {
  var file = verbs[j];
  if (!_fs["default"].lstatSync(methodDir + file).isDirectory()) {
    var name = file.split(".js")[0];
    var imported = await function (specifier) {
      return new Promise(function (r) {
        return r(specifier);
      }).then(function (s) {
        return _interopRequireWildcard(require(s));
      });
    }("".concat(methodDir).concat(file));
    var importedMethod = imported["default"];
    Object.defineProperty(Kowloon, name, {
      enumerable: true,
      configurable: true,
      value: importedMethod
    });
  }
}
await Kowloon.init();
var _default = Kowloon;
exports["default"] = _default;