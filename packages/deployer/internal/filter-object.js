/**
 * Filter the given object to remove the values using a filter function. Much like
 * Array.prototype.filter but for plain objects.
 * @param {object} obj
 * @param {(val: any, key: string) => boolean} filterFn
 * @returns {object}
 */
module.exports = function filterObject(obj, filterFn) {
  const filtered = Object.entries(obj).filter(([key, val]) => filterFn(val, key));
  return Object.fromEntries(filtered);
};
