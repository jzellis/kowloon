"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = handler;
function handler(value) {
  if (this.testing == true) console.log("Testing", value);
}