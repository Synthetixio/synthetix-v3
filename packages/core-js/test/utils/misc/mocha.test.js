const assert = require('assert/strict');
const chalk = require('chalk');
const { printGasUsed } = require('../../../utils/misc/mocha');

describe('utils/tests.js', () => {
  it('can print the gas used in a test', async () => {
    const test = {
      _runnable: {
        title: 'Hello',
      },
    };

    const gasUsed = 1337;
    printGasUsed({ test, gasUsed });

    assert.equal(test._runnable.title, `Hello (${chalk.green(gasUsed)}${chalk.gray(' gas)')}`);
  });
});
