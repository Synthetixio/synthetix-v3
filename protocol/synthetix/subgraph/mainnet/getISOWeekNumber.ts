/* eslint-disable no-undef */

// exported for test
export function getISOWeekNumber(timestamp: i64): i64 {
  const dateOfTimeStamp = new Date(<i64>timestamp).toISOString().slice(0, 4);
  // Calculate the timestamp for the first day of the year
  const firstDayDate = Date.parse(dateOfTimeStamp + '-01-01T00:00:00.000Z');

  const firstDayTimestamp = firstDayDate.getTime() as f64;
  // Calculate the day of the week for the first day of the year (0 = Sunday, 6 = Saturday)
  const firstDayOfWeek = firstDayDate.getUTCDay() as f64;

  // Calculate the number of milliseconds in one day
  const oneDay = (1000 * 60 * 60 * 24) as f64;
  // Calculate the number of days between the first day of the year and the date in question
  const msSinceFirstDayOfYear = ((timestamp as f64) - firstDayTimestamp) as f64;
  const days = Math.round(msSinceFirstDayOfYear / oneDay);

  // Calculate the week number (weeks start on Monday)
  return Math.floor((days + firstDayOfWeek) / 7) as i64;
}
