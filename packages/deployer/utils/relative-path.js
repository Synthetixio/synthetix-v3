/**
 * Get the relative path from the current running process folder. This should
 * only be used for printing information purposes
 * @param {string} filepath
 * @returns {string}
 */
module.exports = function relativePath(filepath) {
  return filepath.replace(new RegExp(`^${process.cwd()}`), '.');
};
