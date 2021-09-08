module.exports = {
  /**
   * Capitalize the first letter of the given string
   * @param {string} str
   * @returns {string}
   */
  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.substring(1) || '';
  },

  /**
   * Checks if the given string starts with a prefix, followed by an uppercase
   * letter.
   * @param {string} str
   * @param {string} prefix
   * @returns {string}
   */
  startsWithWord(str, prefix) {
    return new RegExp(`^${prefix}[A-Z]`).test(str);
  },
};
