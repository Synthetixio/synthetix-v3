const fs = require('fs');
const path = require('path');
const { request } = require('http');
const { resetHardhatContext } = require('hardhat/plugins-testing');
const { takeSnapshot, restoreSnapshot } = require('@synthetixio/core-js/utils/rpc');

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
    // Set node environments root on the given fixture project root
    process.chdir(_getEnvironmentPath(fixtureProjectName));

    // Load global hardhat environement
    this.hre = require('hardhat');

    // Save a snapshot to be reverted at the end of each test
    snapshotId = await takeSnapshot(this.hre.ethers.provider);

    // Load sample project's initializers, for being able to deploy and set it up
    const createInitializer = _getEnvironmentInitializer(fixtureProjectName);
    const { deploySystem, initSystem } = createInitializer(this.hre);

    // Allow the tests to execute the configured deploy method on the loaded environment
    this.deploySystem = deploySystem;

    // Allow to initialize a deployment from the tests
    this.initSystem = initSystem;
  });

  afterEach('resetting environment', async function () {
    // Reset global loaded hardhat envrironment
    resetHardhatContext();

    // Restore blockchain snapshot to its original state before the test run
    await restoreSnapshot(snapshotId, this.hre.ethers.provider);
  });
}

function _getEnvironmentPath(fixtureProjectName) {
  const pathname = path.join(__dirname, 'fixture-projects', fixtureProjectName);

  if (!fs.existsSync(pathname)) {
    throw new Error(`Invalid fixture project ${fixtureProjectName}`);
  }

  return pathname;
}

function _getEnvironmentInitializer(fixtureProjectName) {
  const initializerPath = `${_getEnvironmentPath(fixtureProjectName)}/test/helpers/initializer`;

  try {
    return require(initializerPath);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      throw new Error(
        `Sample project didn't define any tests environment initializer helper: ${initializerPath}`
      );
    }

    throw err;
  }
}

module.exports = {
  useEnvironment,
};
