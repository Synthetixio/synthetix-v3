import chalk from 'chalk';
import { Context } from 'mocha';

export function printGasUsed({ test, gasUsed }: { test: Context; gasUsed: number }) {
  test.runnable().title = `${test.runnable().title} (${chalk.green(gasUsed)}${chalk.gray(' gas)')}`;
}
