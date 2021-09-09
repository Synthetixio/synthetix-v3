const fs = require('fs');
const path = require('path');
const Mustache = require('mustache');

function getGeneratedContractPaths(config) {
  return [path.join(config.paths.sources, 'Router.sol')];
}

function renderTemplate(filepath, data = {}) {
  const template = fs.readFileSync(filepath).toString();
  return Mustache.render(template, data);
}

module.exports = {
  renderTemplate,
  getGeneratedContractPaths,
};
