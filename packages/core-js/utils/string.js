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
   * E.g.:
   *   startsWithWord('GenRouter', 'Gen') // true
   *   startsWithWord('SomeModule', 'Gen') // false
   *   startsWithWord('GenerationalModule', 'Gen') // false
   * @param {string} str
   * @param {string} word
   * @returns {string}
   */
  startsWithWord(str, word) {
    if (str === word) return true;
    return new RegExp(`^${word}[A-Z]`).test(str);
  },
};
