module.exports = {
  logLevel: 3,

  log: function (msg, level = 1) {
    const diff = this.logLevel - level;

    const tab = '  ';

    if (diff >= 0) {
      console.log(tab.repeat(level), msg);
    }
  },
};
