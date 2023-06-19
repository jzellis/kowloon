"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = handler;
function handler(id) {
  var parsed = id.split("@");
  return "".concat(parsed[2], "/.well-known/webfinger?resource=acct:").concat(id);
}