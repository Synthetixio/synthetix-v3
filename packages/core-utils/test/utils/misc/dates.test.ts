import { deepEqual, equal } from 'assert/strict';

import { daysToSeconds, fromUnixTimestamp, getUnixTimestamp } from '../../../src/utils/misc/dates';

describe('utils/misc/dates.ts', function () {
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
