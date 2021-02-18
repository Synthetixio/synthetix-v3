const fs = require('fs');
const path = require('path');
const { getCommit } = require('./git');

function readDeploymentFile({ hre }) {
  _createDeploymentFileIfNeeded({ hre });

  return JSON.parse(fs.readFileSync(_getDeploymentFilePath({ hre })));
}

function saveDeploymentFile({ data, hre }) {
  fs.writeFileSync(_getDeploymentFilePath({ hre }), JSON.stringify(data, null, 2));
}

// Retrieve saved data about this deployment.
// Note: Deployments are tracked by the hash of the current
// commit in the source code.
function readCurrentDeploymentData({ hre }) {
  const commitHash = getCommit();

  const deploymentFile = readDeploymentFile({ hre });
  if (!deploymentFile[commitHash]) {
    deploymentFile[commitHash] = {};
  }

  const deploymentData = deploymentFile[commitHash];

  if (!deploymentData.commitHash) {
    deploymentData.commitHash = commitHash;
  }

  if (!deploymentData.modules) {
    deploymentData.modules = {};
  }

  return deploymentData;
}

function saveCurrentDeploymentData({ deploymentData, hre }) {
  const commitHash = getCommit();

  const deploymentFile = readDeploymentFile({ hre });
  deploymentFile[commitHash] = deploymentData;

  saveDeploymentFile({ data: deploymentFile, hre });
}

function _getDeploymentFilePath({ hre }) {
  return path.join(_getDeploymentsDirectoryPath({ hre }), `${hre.network.name}.json`);
}

function _getDeploymentsDirectoryPath({ hre }) {
  return hre.config.deployer.paths.deployments;
}

function _createDeploymentFileIfNeeded({ hre }) {
  const directoryPath = hre.config.deployer.paths.deployments;

  if (!fs.existsSync(_getDeploymentsDirectoryPath({ hre }))) {
    fs.mkdirSync(directoryPath);
  }

  const filePath = _getDeploymentFilePath({ hre });
  if (!fs.existsSync(filePath)) {
    const deployment = {};

    fs.appendFileSync(filePath, JSON.stringify(deployment, null, 2));
  }
}

module.exports = {
  readDeploymentFile,
  saveDeploymentFile,
  readCurrentDeploymentData,
  saveCurrentDeploymentData,
};
