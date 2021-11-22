const fs = require('fs');
const path = require('path');
const { resetHardhatContext } = require('hardhat/plugins-testing');
const { takeSnapshot, restoreSnapshot } = require('@synthetixio/core-js/utils/rpc');
const { deploySystem } = require('../utils/tests');

function useEnvironment(fixtureProjectName) {
  let snapshotId;

  beforeEach('loading environment', async function () {
    this.timeout(25000);

    const envPath = _getEnvironmentPath(fixtureProjectName);

    // Set node environments root on the given fixture project root
    process.chdir(envPath);

    // Load global hardhat environement
    this.hre = require('hardhat');

    this.deploymentInfo = {
      network: this.hre.config.defaultNetwork,
      instance: 'test',
    };

    const initializer = _safeRequire(path.join(envPath, 'test', 'helpers', 'initializer'));

    // Allow the tests to execute the configured deploy method on the loaded environment
    this.deploySystem = async (customOptions = {}) => {
      await deploySystem(this.deploymentInfo, customOptions, this.hre);

      if (customOptions.clear) {
        await initializer(this.deploymentInfo, this.hre);
      }
    };
  });

  beforeEach('take a snapshot', async function () {
    snapshotId = await takeSnapshot(this.hre.ethers.provider);
  });

  afterEach('resetting environment', async function () {
    // Reset global loaded hardhat envrironment
    resetHardhatContext();
  });

  afterEach('restore the snapshot', async function () {
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

function _safeRequire(pathname, defaults = () => {}) {
  try {
    return require(pathname);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      return defaults;
    }

    throw err;
  }
}

module.exports = {
  useEnvironment,
};
