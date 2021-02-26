const chalk = require('chalk');

const TAB = '  ';
const BOX_WIDTH = 70;

module.exports = {
  debudding: false,
  prepend: '',
  postpend: '',
  boxing: false,

  boxStart: function () {
    this.log(chalk.yellow(`┏${'━'.repeat(BOX_WIDTH)}┑`));
    this.boxing = true;
    this.prepend = chalk.yellow('┃ ');
    this.postpend = chalk.yellow(' ┃');
  },

  boxEnd: function () {
    this.boxing = false;
    this.prepend = '';
    this.postpend = '';
    this.log(chalk.yellow(`┗${'━'.repeat(BOX_WIDTH)}┛`));
  },

  log: function (msg, indent = 0) {
    const indentStr = TAB.repeat(indent);
    const completeLen = Math.max(BOX_WIDTH + 8 - msg.length, 0);
    const completeStr = this.boxing ? chalk.gray('.'.repeat(completeLen)) : '';
    console.log(`${this.prepend}${indentStr}${msg}${completeStr}${this.postpend}`);
  },

  title: function (msg, indent) {
    this.log(chalk.blue.bold.inverse(msg), indent);
  },

  subtitle: function (msg, indent) {
    this.log(chalk.cyan.bold(`‣ ${msg}`), indent);
  },

  info: function (msg, indent) {
    this.log(chalk.gray(`ⓘ  ${msg}`), indent);
  },

  notice: function (msg, indent) {
    this.log(chalk.yellow(`> ${msg}`), indent);
  },

  warn: function (msg, indent) {
    this.log(chalk.yellow.bold.inverse(`⚠ ${msg}`), indent);
  },

  checked: function (msg, indent) {
    this.log(chalk.gray(`✓ ${msg}`), indent);
  },

  success: function (msg, indent) {
    this.log(chalk.green(`✅ ${msg}`), indent);
  },

  complete: function (msg, indent) {
    this.log(chalk.green.bold(`💯 ${msg}`), indent);
  },

  debug: function (msg, indent) {
    if (!this.debugging) {
      return;
    }

    this.log(chalk.magenta(`${msg}`), indent);
  },
};
