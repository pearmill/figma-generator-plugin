const path = require('path');
const libraryName = 'index';

let plugins = [];

const baseConfig = {
  entry: [`./${libraryName}.ts`],
  module: {
    rules: [
      {
        loader:'babel-loader',
        test: /\.ts$/,
        exclude:  /node_modules/
      }
    ]
  },
  resolve: {
    extensions: ['.js']
  },
  plugins: plugins
}

const output = {
  ...baseConfig,
  mode: 'development',
  devtool: false,
  output: {
    pathinfo: false,
    path: path.join(__dirname, 'dist'),
    filename: `${libraryName}.js`
  }
}

module.exports = [
  output
];
