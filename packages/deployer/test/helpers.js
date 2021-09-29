const fs = require('fs');
const path = require('path');
const { resetHardhatContext } = require('hardhat/plugins-testing');

function _getEnvironmentPath(fixtureProjectName) {
  const pathname = path.join(__dirname, 'fixture-projects', fixtureProjectName);

  if (!fs.existsSync(pathname)) {
    throw new Error(`Invalid fixture project ${fixtureProjectName}`);
  }

  return pathname;
}

function useEnvironment(fixtureProjectName) {
  beforeEach('Loading hardhat environment', function () {
    process.chdir(_getEnvironmentPath(fixtureProjectName));
    this.hre = require('hardhat');
  });

  afterEach('Resetting hardhat', function () {
    resetHardhatContext();
  });
}

module.exports = {
  useEnvironment,
};
