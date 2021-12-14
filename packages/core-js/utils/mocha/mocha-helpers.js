const chalk = require('chalk');

function printGasUsed({ test, gasUsed }) {
  test._runnable.title = `${test._runnable.title} (${chalk.green(gasUsed)}${chalk.gray(' gas)')}`;
}

module.exports = {
  printGasUsed,
};
