"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var handler = function handler(res, req, next) {
  var response = "Hello POST";
  var status = 200;
  res.status(status).send(response);
};
var _default = handler;
exports["default"] = _default;