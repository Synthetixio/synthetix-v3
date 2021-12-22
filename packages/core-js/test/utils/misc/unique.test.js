const { deepEqual } = require('assert/strict');
const unique = require('../../../utils/misc/unique');

describe('utils/misc/unique.js', function () {
  it('removes strictly repeated values', function () {
    deepEqual([1, 2, 3, null], [1, 2, 2, 3, null, null].filter(unique));
  });
});
