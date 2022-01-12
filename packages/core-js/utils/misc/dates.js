/**
 * Get the date in format `YYYY-MM-DD`
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
function formatDate(date = new Date()) {
  if (!(date instanceof Date)) {
    throw new Error('Invalid date given');
  }

  return date.toISOString().slice(0, 10);
}

function getUnixTimestamp() {
  return Math.floor(new Date().getTime() / 1000);
}

const daysToSeconds = (days) => days * 3600 * 24;

module.exports = {
  formatDate,
  getUnixTimestamp,
  daysToSeconds,
};
