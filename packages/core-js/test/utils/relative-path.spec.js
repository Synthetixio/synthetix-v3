const assert = require('assert/strict');
const relativePath = require('../../utils/relative-path');

describe('utils/relative-path.js', () => {
  it('can show the current path', async () => {
    assert.equal(relativePath(__dirname), 'test/utils');
  });
});
