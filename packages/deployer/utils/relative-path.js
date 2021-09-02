/**
 * Get the relative path from the current running hardhat project folder.
 * @param {string} filepath
 * @returns {string}
 */
module.exports = function relativePath(filepath) {
  return filepath.replace(new RegExp(`^${hre.config.paths.root}/`), '');
};
