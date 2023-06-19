"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = handler;
function handler(id) {
  var parsed = id.split("@");
  return {
    user: parsed[1],
    domain: parsed[2]
  };
}