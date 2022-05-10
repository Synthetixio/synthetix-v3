const assert = require('assert/strict');
const relativePath = require('../../../utils/misc/relative-path');

describe('utils/misc/relative-path.js', () => {
  it('can show the current path', () => {
    assert.equal(relativePath(__dirname), 'test/utils/misc');
  });
});
