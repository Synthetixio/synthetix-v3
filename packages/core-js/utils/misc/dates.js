/**
 * Get the date in format `YYYY-MM-DD`
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
function formatDate(date = new Date()) {
  if (!(date instanceof Date)) {
    throw new Error('Invalid date given');
  }

  return date.toISOString();
}

function getUnixTimestamp(date = new Date()) {
  return Math.floor(date.getTime() / 1000);
}

function fromUnixTimestamp(timestamp) {
  return new Date(timestamp * 1000);
}

function toUnixTimestamp(date) {
  return Math.floor(date.getTime() / 1000);
}

const daysToSeconds = (days) => days * 3600 * 24;

module.exports = {
  formatDate,
  getUnixTimestamp,
  fromUnixTimestamp,
  toUnixTimestamp,
  daysToSeconds,
};
