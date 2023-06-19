"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _path = _interopRequireDefault(require("path"));
var _webpack = _interopRequireDefault(require("webpack"));
var _url = require("url");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
var _dirname = _path["default"].dirname(__filename);
var _default = {
  target: "node",
  // use require() & use NodeJs CommonJS style
  externals: [webpackNodeExternals()],
  // in order to ignore all modules in node_modules folder
  externalsPresets: {
    node: true // in order to ignore built-in modules like path, fs, etc.
  },

  // optimization: {
  //   minimize: false,
  // },
  entry: _path["default"].join(_dirname, "client", "index.js"),
  module: {
    rules: [{
      test: /\.(js|jsx)$/,
      exclude: /node_modules/,
      use: {
        loader: "babel-loader"
      }
    }, {
      test: /\.css$/i,
      include: _path["default"].resolve(_dirname, "client"),
      exclude: /node_modules/,
      use: ["style-loader", "css-loader", "postcss-loader"]
    }]
  },
  resolve: {
    modules: [_path["default"].resolve(_dirname, "../node_modules"), "node_modules"],
    extensions: [".*", ".js", ".jsx"],
    fullySpecified: false
  },
  output: {
    path: _path["default"].join(_dirname, "public"),
    filename: "bundle.js",
    publicPath: "/"
  },
  plugins: [new _webpack["default"].HotModuleReplacementPlugin()],
  devServer: {
    hot: true,
    historyApiFallback: true
  }
};
exports["default"] = _default;