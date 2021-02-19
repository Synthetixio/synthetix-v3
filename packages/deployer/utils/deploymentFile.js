const fs = require('fs');
const path = require('path');

function readDeploymentFile({ hre }) {
  _createDeploymentFileIfNeeded({ hre });

  const deploymentData = JSON.parse(fs.readFileSync(_getDeploymentFilePath({ hre })));
  _patchDeploymentData({ deploymentData });

  return deploymentData;
}

function saveDeploymentFile({ deploymentData, hre }) {
  fs.writeFileSync(_getDeploymentFilePath({ hre }), JSON.stringify(deploymentData, null, 2));
}

function _patchDeploymentData({ deploymentData }) {
  if (!deploymentData.modules) {
    deploymentData.modules = {};
  }
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
    fs.appendFileSync(filePath, '{}');
  }
}

module.exports = {
  readDeploymentFile,
  saveDeploymentFile,
};
