import chalk from 'chalk';

export function printGasUsed({ test, gasUsed }: { test: any, gasUsed: number }) {
  test._runnable.title = `${test._runnable.title} (${chalk.green(gasUsed)}${chalk.gray(' gas)')}`;
}