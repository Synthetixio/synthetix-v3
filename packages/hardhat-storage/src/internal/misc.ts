/**
 * Helper function intended to be used as [].filter(isPresent) to remove all
 * unexistant values from an array.
 */
export function isPresent<T>(val: T): val is NonNullable<T> {
  return val !== null && typeof val !== 'undefined';
}
