const fs = require('fs');
const path = require('path');
const { request } = require('http');
const { resetHardhatContext } = require('hardhat/plugins-testing');

function _getEnvironmentPath(fixtureProjectName) {
  const pathname = path.join(__dirname, 'fixture-projects', fixtureProjectName);

  if (!fs.existsSync(pathname)) {
    throw new Error(`Invalid fixture project ${fixtureProjectName}`);
  }

  return pathname;
}

function useEnvironment(fixtureProjectName) {
  // TODO: enable tests when the connection to the hardhat network works
  // More info: https://github.com/Synthetixio/synthetix-v3/issues/143
  //
  // This hook is checking if the local network is available, and if its not,
  // it will skip all the tests without throwing any errors
  before('check connection with local network', async function () {
    await new Promise((resolve) => {
      const req = request('http://localhost:8545', { method: 'HEAD', timeout: 500 }, resolve);

      req.on('error', (err) => {
        console.warn('Skipping hardhat dependant tests because of missing local network', err);
        resolve();
        this.skip();
      });

      req.end();
    });
  });

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
