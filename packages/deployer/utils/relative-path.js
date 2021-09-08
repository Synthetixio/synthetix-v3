/**
 * Get the relative path from the folders, without the leading points.
 * E.g.:
 *   const relative = relativePath('/User/hardhat/contracts/modules/Proxy.sol', '/User/hardhat')
 *   // contracts/modules/Proxy.sol
 * @param {string} filepath
 * @param {string} [from=process.cwd()]
 * @returns {string}
 */
module.exports = function relativePath(filepath, from = process.cwd()) {
  return filepath.replace(new RegExp(`^${from}/`), '');
};
