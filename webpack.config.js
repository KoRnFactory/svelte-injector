const path = require("path");

const mode = process.env.NODE_ENV || 'development';
const prod = mode === 'production';

module.exports = {
  entry: './src/index.ts',
  output: {
    path: path.resolve(__dirname, 'lib'),
    filename: '[name].js',
    library: 'SvelteInjector',
    libraryTarget: "umd",
    umdNamedDefine: true
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: "ts-loader",
        exclude: /node_modules/
      },
      {
        test: /\.svelte$/,
        loader: "svelte-loader",
        exclude: /node_modules/
      }
    ]
  },
  mode,
  resolve:{
    extensions: ['.ts', '.js', '.svelte']
  }
}
