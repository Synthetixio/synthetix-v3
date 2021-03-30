function getCommit() {
  return _removeLastCharacter(
    require('child_process').execSync('git rev-parse HEAD').toString().slice(0, 40)
  );
}

function getBranch() {
  return _removeLastCharacter(
    require('child_process').execSync('git rev-parse --abbrev-ref HEAD').toString()
  );
}

function _removeLastCharacter(str) {
  return str.slice(0, str.length - 1);
}

module.exports = {
  getCommit,
  getBranch,
};
