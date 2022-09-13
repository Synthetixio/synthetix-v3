import assert from 'assert/strict';
import chalk from 'chalk';
import { Context } from 'mocha';

import { printGasUsed } from '../../../src/utils/mocha/mocha-helpers';

describe('utils/tests.ts', function () {
  it('can print the gas used in a test', function () {
    const test = {
      _runnable: {
        title: 'Hello',
      },
      runnable: () => test._runnable,
    };

    const gasUsed = 1337;
    printGasUsed({
      test: test as unknown as Context,
      gasUsed,
    });

    assert.equal(test._runnable.title, `Hello (${chalk.green(gasUsed)}${chalk.gray(' gas)')}`);
  });
});
