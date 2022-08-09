/**
 * Filter all the values from an array to get only repeated ones
 *   e.g.: [1, 1, 2, 3].filter(onlyRepeated) // => [1]
 */
export function onlyRepeated<T>(value: T, index: number, self: T[]) {
  const last = self.lastIndexOf(value);
  return self.indexOf(value) !== last && index === last;
}

/**
 * Filter all the values from an array to get only unique ones
 *   e.g.: [1, 1, 2, 3].filter(onlyUnique) // => [1, 2, 3]
 */
export function onlyUnique<T>(value: T, index: number, self: T[]) {
  return self.indexOf(value) === index;
}
