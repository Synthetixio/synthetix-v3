import chalk from 'chalk';

const BOX_WIDTH = 90;

export default {
  _log: console.log.bind(console),
  quiet: false,
  debugging: false,
  prepend: '',
  postpend: '',
  boxing: false,

  boxStart() {
    this.log(chalk.cyan.bold(`┏${'━'.repeat(BOX_WIDTH)}┓`));

    this.boxing = true;
    this.prepend = chalk.cyan.bold('┃ ');
    this.postpend = chalk.cyan.bold(' ┃');
  },

  boxEnd() {
    this.boxing = false;
    this.prepend = '';
    this.postpend = '';

    this.log(chalk.cyan.bold(`┗${'━'.repeat(BOX_WIDTH)}┛`));
  },

  log(msg: string) {
    if (this.quiet) {
      return;
    }

    const completeLen = Math.max(BOX_WIDTH + 8 - [...msg].length, 0);
    const completeStr = this.boxing ? chalk.gray(' '.repeat(completeLen)) : '';

    this._log(`${this.prepend}${msg}${completeStr}${this.postpend}`);
  },

  title(msg: string) {
    if (this.quiet) {
      return;
    }

    this._log(chalk.yellow.bold.underline(msg));
  },

  subtitle(msg: string) {
    if (this.quiet) {
      return;
    }

    this._log('\n');

    this.boxStart();
    this.log(chalk.cyan(`‣ ${msg}`));
    this.boxEnd();
  },

  info(msg: string) {
    this.log(chalk.gray(`ⓘ  ${msg}`));
  },

  notice(msg: string) {
    this.log(chalk.yellow(`! ${msg}`));
  },

  error(msg: string) {
    this.log(chalk.red.bold.inverse(`☠ ${msg}`));
  },

  warn(msg: string) {
    this.log(chalk.yellow.bold.inverse(`⚠ ${msg}`));
  },

  checked(msg: string) {
    this.log(chalk.gray(`✓ ${msg}`));
  },

  success(msg: string) {
    this.log(chalk.green(`✅ ${msg}`));
  },

  complete(msg: string) {
    this.log(chalk.green.bold(`💯 ${msg}`));
  },

  debug(msg: string) {
    if (!this.debugging) {
      return;
    }

    this.log(chalk.magenta(`${msg}`));
  },
};
