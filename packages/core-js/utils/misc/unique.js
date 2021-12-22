/**
 * Helper array unique function to be used with Array.filter method.
 *   e.g.: [1, 1, 2, 3].filter(unique) // => [1, 2, 3]
 */
module.exports = function unique(value, index, self) {
  return self.indexOf(value) === index;
};
