import { equal } from 'assert/strict';
import { capitalize } from '../../../utils/misc/strings';

describe('utils/misc/strings.js', function () {
  it('returns the strings with the correct format', function () {
    equal(capitalize('someText'), 'SomeText');
    equal(capitalize('SomeText'), 'SomeText');
    equal(capitalize('sOmeText'), 'SOmeText');
    equal(capitalize('SOmeText'), 'SOmeText');

    equal(capitalize('s'), 'S');
    equal(capitalize('S'), 'S');

    equal(capitalize('1number'), '1number');
    equal(capitalize('_otherValue'), '_otherValue');
  });
});
