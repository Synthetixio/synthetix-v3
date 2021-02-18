module.exports = {
  logLevel: 3,

  log: function (msg, level = 1) {
    const diff = this.logLevel - level;

    if (diff >= 0) {
      console.log(`${'  '.repeat(level - 1)}${msg}`);
    }
  },
};
