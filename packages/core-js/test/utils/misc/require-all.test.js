const assert = require('assert/strict');
const { requireAll } = require('../../../utils/misc/require-all');

describe('utils/misc/require-all.js', () => {
  it('requires all the files from the given folder', () => {
    assert.deepEqual(requireAll(`${__dirname}/../../fixtures/require-all-example`), [1, 2]);
  });
});
