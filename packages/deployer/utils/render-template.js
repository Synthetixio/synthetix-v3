const fs = require('fs');
const Mustache = require('mustache');

module.exports = function renderTemplate(filepath, data = {}) {
  const template = fs.readFileSync(filepath).toString();
  return Mustache.render(template, data);
};
