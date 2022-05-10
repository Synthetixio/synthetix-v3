const path = require('path');
const fs = require('fs');

/**
 * Require all the .js and .json files from the given folder.
 * @param {string} pathname
 * @param {string[]} extensions
 * @returns {unknown[]}
 */
function requireAll(pathname, extensions = ['.js', '.json']) {
  return fs
    .readdirSync(path.resolve(pathname))
    .filter((filename) => extensions.includes(path.extname(filename)))
    .map((filename) => require(path.resolve(pathname, filename)));
}

module.exports = {
  requireAll,
};
