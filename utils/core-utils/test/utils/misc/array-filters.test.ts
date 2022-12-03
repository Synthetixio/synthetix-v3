import { deepEqual } from 'assert/strict';

import { onlyRepeated, onlyUnique } from '../../../src/utils/misc/array-filters';

describe('utils/misc/array-filters.ts', function () {
  describe('#onlyRepeated', function () {
    it('leaves one instance of repeated values', function () {
      deepEqual([2, null], [1, 2, 2, 3, null, null, null].filter(onlyRepeated));
    });
  });

  describe('#onlyUnique', function () {
    it('leaves only unqiue values', function () {
      deepEqual([1, 2, 3, null], [1, 2, 2, 3, null, null, null].filter(onlyUnique));
    });
  });
});
