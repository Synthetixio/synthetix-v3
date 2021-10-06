const fs = require('fs');
const path = require('path');
const { request } = require('http');
const { resetHardhatContext } = require('hardhat/plugins-testing');
const { takeSnapshot, restoreSnapshot } = require('@synthetixio/core-js/utils/rpc');

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

  let snapshotId;

  beforeEach('loading environment', async function () {
    const environementPath = _getEnvironmentPath(fixtureProjectName);

    // Set node environments root on the given fixture project root
    process.chdir(environementPath);

    // Load global hardhat environement
    this.hre = require('hardhat');

    // Save an snapshot to be resseted at the end of tests
    snapshotId = await takeSnapshot(this.hre.ethers.provider);

    const { deploy, init } = require(`${environementPath}/test/helpers/initializer`)(this.hre);

    // Allow the tests to execute the configured deploy method on the loaded environment
    this.deploy = deploy;

    // Allow to initialize a deployment from the tests
    this.init = init;
  });

  afterEach('resetting environment', async function () {
    // Reset global loaded hardhat envrironment
    resetHardhatContext();

    // Restore blockchain snapshot to its original state
    await restoreSnapshot(snapshotId, this.hre.ethers.provider);
  });
}

module.exports = {
  useEnvironment,
};
