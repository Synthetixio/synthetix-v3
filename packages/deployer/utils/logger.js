const chalk = require('chalk');

const BOX_WIDTH = 70;

module.exports = {
  debugging: false,
  prepend: '',
  postpend: '',
  boxing: false,

  boxStart: function () {
    this.log(chalk.cyan.bold(`┏${'━'.repeat(BOX_WIDTH)}┓`));

    this.boxing = true;
    this.prepend = chalk.cyan.bold('┃ ');
    this.postpend = chalk.cyan.bold(' ┃');
  },

  boxEnd: function () {
    this.boxing = false;
    this.prepend = '';
    this.postpend = '';

    this.log(chalk.cyan.bold(`┗${'━'.repeat(BOX_WIDTH)}┛`));
  },

  log: function (msg) {
    const completeLen = Math.max(BOX_WIDTH + 8 - [...msg].length, 0);
    const completeStr = this.boxing ? chalk.gray('.'.repeat(completeLen)) : '';

    console.log(`${this.prepend}${msg}${completeStr}${this.postpend}`);
  },

  subtitle: function (msg) {
    console.log('\n');

    this.boxStart();
    this.log(chalk.cyan(`‣ ${msg}`));
    this.boxEnd();
  },

  info: function (msg) {
    this.log(chalk.gray(`ⓘ  ${msg}`));
  },

  notice: function (msg) {
    this.log(chalk.yellow(`> ${msg}`));
  },

  warn: function (msg) {
    this.log(chalk.yellow.bold.inverse(`⚠⚠⚠ ${msg} ⚠⚠⚠`));
  },

  checked: function (msg) {
    this.log(chalk.gray(`✓ ${msg}`));
  },

  success: function (msg) {
    this.log(chalk.green(`✅ ${msg}`));
  },

  complete: function (msg) {
    this.log(chalk.green.bold(`💯 ${msg}`));
  },

  debug: function (msg) {
    if (!this.debugging) {
      return;
    }

    this.log(chalk.magenta(`${msg}`));
  },
};
