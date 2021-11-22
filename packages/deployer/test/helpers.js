const fs = require('fs');
const path = require('path');
const { resetHardhatContext } = require('hardhat/plugins-testing');
const { takeSnapshot, restoreSnapshot } = require('@synthetixio/core-js/utils/rpc');
const { deploySystem } = require('../utils/tests');

function useEnvironment(fixtureProjectName) {
  let snapshotId;

  beforeEach('loading environment', async function () {
    this.timeout(25000);

    // Set node environments root on the given fixture project root
    process.chdir(_getEnvironmentPath(fixtureProjectName));

    // Load global hardhat environement
    this.hre = require('hardhat');

    // Save a snapshot to be reverted at the end of each test
    snapshotId = await takeSnapshot(this.hre.ethers.provider);

    this.deploymentInfo = {
      network: this.hre.config.defaultNetwork,
      instance: 'test',
    };

    // Allow the tests to execute the configured deploy method on the loaded environment
    this.deploySystem = async (customOptions = {}) => {
      await deploySystem(this.deploymentInfo, customOptions, this.hre);
    };
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

module.exports = {
  useEnvironment,
};
