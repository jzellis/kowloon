import path from "path";
import webpack from "webpack";
import { fileURLToPath } from "url";
const __dirname = path.dirname(__filename);
export default {
  target: "node", // use require() & use NodeJs CommonJS style
  externals: [webpackNodeExternals()], // in order to ignore all modules in node_modules folder
  externalsPresets: {
    node: true, // in order to ignore built-in modules like path, fs, etc.
  },
  // optimization: {
  //   minimize: false,
  // },
  entry: path.join(__dirname, "client", "index.js"),
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
        },
      },
      {
        test: /\.css$/i,
        include: path.resolve(__dirname, "client"),
        exclude: /node_modules/,
        use: ["style-loader", "css-loader", "postcss-loader"],
      },
    ],
  },
  resolve: {
    modules: [path.resolve(__dirname, "../node_modules"), "node_modules"],
    extensions: [".*", ".js", ".jsx"],
    fullySpecified: false,
  },
  output: {
    path: path.join(__dirname, "public"),
    filename: "bundle.js",
    publicPath: "/",
  },
  plugins: [new webpack.HotModuleReplacementPlugin()],
  devServer: {
    hot: true,
    historyApiFallback: true,
  },
};
