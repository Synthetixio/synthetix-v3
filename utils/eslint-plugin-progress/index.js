/* eslint-disable no-console */

const path = require('path');

const CWD = process.cwd();

function create(context) {
  const filename = context.getFilename();
  const relativeFilePath = path.relative(CWD, filename);

  console.log('Checked:', relativeFilePath);
  return {};
}

module.exports = {
  rules: {
    enable: {
      create,
    },
  },
};
