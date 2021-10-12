/**
 * Get the date in format `YYYY-MM-DD`
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
module.exports = function getDate(date = new Date()) {
  if (!(date instanceof Date)) {
    throw new Error('Invalid date given');
  }

  return date.toISOString().slice(0, 10);
};
