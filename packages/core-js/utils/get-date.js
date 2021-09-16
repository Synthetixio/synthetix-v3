/**
 * Get the date in format `YYYY-MM-DD`
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
module.exports = function getDate(date = new Date()) {
  const year = `${date.getUTCFullYear()}`;
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};
