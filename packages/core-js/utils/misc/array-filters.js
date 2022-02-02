/**
 * Filter all the values from an array to get only repeated ones
 *   e.g.: [1, 1, 2, 3].filter(onlyRepeated) // => [1]
 */
function onlyRepeated(value, index, self) {
  const last = self.lastIndexOf(value);
  return self.indexOf(value) !== last && index === last;
}

/**
 * Filter all the values from an array to get only unique ones
 *   e.g.: [1, 1, 2, 3].filter(onlyUnique) // => [1, 2, 3]
 */
function onlyUnique(value, index, self) {
  return self.indexOf(value) === index;
}

module.exports = {
  onlyUnique,
  onlyRepeated,
};
