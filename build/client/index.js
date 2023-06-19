"use strict";

var _react = _interopRequireDefault(require("react"));
var _client = _interopRequireDefault(require("react-dom/client"));
var _reactRouterDom = require("react-router-dom");
require("./index.css");
var _index2 = _interopRequireDefault(require("./routes/Home/index.jsx"));
var _index3 = _interopRequireDefault(require("./routes/Login/index.jsx"));
var _index4 = _interopRequireDefault(require("./components/Layout/index.jsx"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
window.React = _react["default"];
var router = (0, _reactRouterDom.createBrowserRouter)([{
  path: "/",
  element: /*#__PURE__*/_react["default"].createElement(_index2["default"], null)
}, {
  path: "login",
  element: /*#__PURE__*/_react["default"].createElement(_index3["default"], null)
}]);
var root = _client["default"].createRoot(document.getElementById("app"));
root.render( /*#__PURE__*/_react["default"].createElement(_react["default"].StrictMode, null, /*#__PURE__*/_react["default"].createElement(_index4["default"], null, /*#__PURE__*/_react["default"].createElement(_reactRouterDom.RouterProvider, {
  router: router
}))));