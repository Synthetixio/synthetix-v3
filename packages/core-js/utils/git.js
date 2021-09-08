const execSync = (cmd) => require('child_process').execSync(cmd).toString().trim();

module.exports = {
  getCommit: () => execSync('git rev-parse HEAD'),
  getBranch: () => execSync('git rev-parse --abbrev-ref HEAD'),
};
