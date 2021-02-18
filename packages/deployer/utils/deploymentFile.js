const fs = require('fs');
const path = require('path');

function readDeploymentFile({ hre }) {
  _createDeploymentFileIfNeeded({ hre });

  return JSON.parse(fs.readFileSync(_getDeploymentFilePath({ hre })));
}

function saveDeploymentFile({ data, hre }) {
  fs.writeFileSync(_getDeploymentFilePath({ hre }), JSON.stringify(data, null, 2));
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
};
