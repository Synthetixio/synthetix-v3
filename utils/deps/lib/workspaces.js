module.exports = async function workspaces() {
  const exec = require('./exec');
  return (await exec('yarn workspaces list --verbose --json'))
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
};
