const chalk = require('chalk');

const BOX_WIDTH = 90;

module.exports = {
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

  log(msg) {
    if (this.quiet) {
      return;
    }

    const completeLen = Math.max(BOX_WIDTH + 8 - [...msg].length, 0);
    const completeStr = this.boxing ? chalk.gray(' '.repeat(completeLen)) : '';

    this._log(`${this.prepend}${msg}${completeStr}${this.postpend}`);
  },

  async title(msg) {
    if (this.quiet) {
      return;
    }

    this._log(chalk.red.bold(msg));
  },

  subtitle(msg) {
    if (this.quiet) {
      return;
    }

    this._log('\n');

    this.boxStart();
    this.log(chalk.cyan(`‣ ${msg}`));
    this.boxEnd();
  },

  info(msg) {
    this.log(chalk.gray(`ⓘ  ${msg}`));
  },

  notice(msg) {
    this.log(chalk.yellow(`! ${msg}`));
  },

  error(msg) {
    this.log(chalk.red.bold.inverse(`☠ ${msg}`));
  },

  warn(msg) {
    this.log(chalk.yellow.bold.inverse(`⚠ ${msg}`));
  },

  checked(msg) {
    this.log(chalk.gray(`✓ ${msg}`));
  },

  success(msg) {
    this.log(chalk.green(`✅ ${msg}`));
  },

  complete(msg) {
    this.log(chalk.green.bold(`💯 ${msg}`));
  },

  debug(msg) {
    if (!this.debugging) {
      return;
    }

    this.log(chalk.magenta(`${msg}`));
  },
};
