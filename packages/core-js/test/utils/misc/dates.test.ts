import { ok, equal, deepEqual, throws } from 'assert/strict';
import { formatDate, getUnixTimestamp, fromUnixTimestamp, daysToSeconds } from '../../../utils/misc/dates';

describe('utils/misc/dates.js', function () {
  describe('formatDate', function () {
    it('returns the date with the correct format', function () {
      const result = formatDate();
      ok(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(result));
    });

    it('returns the date with the correct format using a custom date', function () {
      const expected = '2011-10-10';
      const result = formatDate(new Date(Date.parse(expected)));
      equal(result, expected);
    });
  });

  describe('getUnixTimestamp', function () {
    it('returns the current unix timestamp in seconds', async function () {
      equal(getUnixTimestamp(), Math.floor(new Date().getTime() / 1000));
    });
  });

  describe('fromUnixTimestamp', function () {
    it('builds a valid date from a unix timestamp', async function () {
      const now = getUnixTimestamp();

      deepEqual(fromUnixTimestamp(now), new Date(now * 1000));
    });
  });

  describe('daysToSeconds', function () {
    it('returns the expected value', async function () {
      equal(daysToSeconds(7), 60 * 60 * 24 * 7);
    });
  });
});
