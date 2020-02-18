const configs = require('./webpack.config');

const output = configs[0]

output.watch = true

module.exports = [output];
