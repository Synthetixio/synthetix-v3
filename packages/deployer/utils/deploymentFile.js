const fs = require('fs');
const path = require('path');

function readDeploymentFile({ hre }) {
  _createDeploymentFileIfNeeded({ hre });

  const data = JSON.parse(fs.readFileSync(_getDeploymentFilePath({ hre })));
  _patchDeploymentData({ data });

  return data;
}

function saveDeploymentFile({ data, hre }) {
  fs.writeFileSync(_getDeploymentFilePath({ hre }), JSON.stringify(data, null, 2));
}

function _patchDeploymentData({ data }) {
  if (!data.modules) {
    data.modules = {};
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
