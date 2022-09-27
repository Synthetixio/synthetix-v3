import assert from 'assert/strict';

import relativePath from '../../../src/utils/misc/relative-path';

describe('utils/misc/relative-path.ts', function () {
  it('can show the current path', function () {
    assert.equal(relativePath(__dirname), 'test/utils/misc');
  });
});
