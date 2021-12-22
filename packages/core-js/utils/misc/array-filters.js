/**
 * Filter all the values from an array to get only repeated ones
 *   e.g.: [1, 1, 2, 3].filter(onlyRepeated) // => [1]
 */
function onlyRepeated(value, index, self) {
  const last = self.lastIndexOf(value);
  return self.indexOf(value) !== last && index === last;
}

module.exports = {
  onlyRepeated,
};
