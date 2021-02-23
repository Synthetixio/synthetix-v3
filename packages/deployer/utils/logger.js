const chalk = require('chalk');

const TAB = '  ';

module.exports = {
  debudding: false,

  log: function (msg, indent = 0) {
    console.log(`${TAB.repeat(indent)}${msg}`);
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
