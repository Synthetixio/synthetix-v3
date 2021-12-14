const { ok, equal, throws } = require('assert/strict');
const getDate = require('../../../utils/misc/get-date');

describe('utils/misc/get-date.js', function () {
  it('returns the date with the correct format', function () {
    const result = getDate();
    ok(/[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(result));
  });

  it('returns the date with the correct format using a custom date', function () {
    const expected = '2011-10-10';
    const result = getDate(new Date(Date.parse(expected)));
    equal(result, expected);
  });

  it('throws an error when given an invalid date object', function () {
    throws(function () {
      getDate('2020-12-12');
    }, new Error('Invalid date given'));
  });
});
