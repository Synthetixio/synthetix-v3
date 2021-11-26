const fs = require('fs');
const path = require('path');
const { TASK_DEPLOY } = require('@synthetixio/deployer/task-names');
const { defaultDeploymentInfo } = require('../../../utils/deployments');
const { resetHardhatContext } = require('hardhat/plugins-testing');

function loadEnvironment(fixtureProjectName) {
  resetHardhatContext();

  const envPath = _getEnvironmentPath(fixtureProjectName);
  process.chdir(envPath);

  return require('hardhat');
}

async function deployOnEnvironment(hre, customOptions = {}) {
  const deploymentInfo = {
    ...defaultDeploymentInfo,
    proxyContract: hre.config.deployer.proxyContract,
    network: hre.config.defaultNetwork,
    instance: 'test',
  };

  await hre.run(TASK_DEPLOY, {
    ...deploymentInfo,
    noConfirm: true,
    quiet: true,
    ...customOptions,
  });

  if (customOptions.clear) {
    try {
      const initializer = require(path.join(
        hre.config.paths.root,
        'test',
        'helpers',
        'initializer'
      ));

      await initializer(deploymentInfo, hre);
    } catch (err) {
      // eslint-disable-next-line
    }
  }
}

function _getEnvironmentPath(fixtureProjectName) {
  const pathname = path.join(__dirname, '..', '..', 'fixture-projects', fixtureProjectName);

  if (!fs.existsSync(pathname)) {
    throw new Error(`Invalid fixture project ${fixtureProjectName}`);
  }

  return pathname;
}

module.exports = {
  loadEnvironment,
  deployOnEnvironment,
};
