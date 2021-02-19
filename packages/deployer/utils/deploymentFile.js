const fs = require('fs');
const path = require('path');

function readDeploymentFile({ hre }) {
	_createDeploymentFileIfNeeded({ hre });

	return JSON.parse(fs.readFileSync(_getDeploymentFilePath({ hre })));
}

function saveDeploymentFile({ deploymentData, hre }) {
	fs.writeFileSync(_getDeploymentFilePath({ hre }), JSON.stringify(deploymentData, null, 2));
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
