const fs = require('fs');
const path = require('path');
const glob = require('glob');
const Mustache = require('mustache');
const { startsWithWord } = require('@synthetixio/core-js/utils/string');

function getGeneratedContractPaths(config) {
  return glob
    .sync(path.join(config.paths.sources, 'Gen*.sol'))
    .filter((file) => startsWithWord(path.basename(file, '.sol'), 'Gen'));
}

function renderTemplate(filepath, data = {}) {
  const template = fs.readFileSync(filepath).toString();
  return Mustache.render(template, data);
};

module.exports = {
  renderTemplate,
  getGeneratedContractPaths,
};
