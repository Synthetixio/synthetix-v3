module.exports = {
  /**
   * Capitalize the first letter of the given string
   * @param {string} str
   * @returns {string}
   */
  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.substring(1) || '';
  },
};
