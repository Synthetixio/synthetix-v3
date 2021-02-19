const fs = require('fs');
const logger = require('../utils/logger');
const prompter = require('../utils/prompter');
const chalk = require('chalk');
const { subtask } = require('hardhat/config');
const { readDeploymentFile, saveDeploymentFile } = require('../utils/deploymentFile');
const { getSourceModules } = require('../utils/getSourceModules');
const { SUBTASK_DEPLOY_MODULES } = require('../task-names');

subtask(SUBTASK_DEPLOY_MODULES).setAction(async ({ force }, hre) => {
	logger.log(chalk.cyan('Deploying modules'));

	const deploymentData = readDeploymentFile({ hre });
	const sourceModules = getSourceModules({ hre });

	const deploymentInfo = await _getDeploymentInfo({ force, deploymentData, sourceModules, hre });
	await _printAndConfirm({ deploymentInfo });
	await _deployModules({ deploymentInfo, deploymentData, sourceModules, hre });

	saveDeploymentFile({ deploymentData, hre });
});

async function _getDeploymentInfo({ force, deploymentData, sourceModules, hre }) {
	const deploymentInfo = {
		deploymentsNeeded: [],
	};

	for (let moduleName of sourceModules) {
		const moduleData = deploymentData.modules[moduleName];

		const info = {};

		if (!info.needsDeployment && force) {
			info.needsDeployment = true;
			info.reason = '--force is true';
		}

		if (!info.eedsDeployment && hre.network.name === 'hardhat') {
			info.needsDeployment = true;
			info.reason = 'Always deploy in hardhat network';
		}

		if (!info.needsDeployment && !moduleData.deployedAddress) {
			info.needsDeployment = true;
			info.reason = 'No deployed address found';
		}

		const sourceBytecodeHash = _getContractBytecodeHash({ moduleName, hre });
		const storedBytecodeHash = moduleData.bytecodeHash;
		const bytecodeChanged = sourceBytecodeHash !== storedBytecodeHash;
		if (!info.needsDeployment && bytecodeChanged) {
			info.needsDeployment = true;
			info.reason = 'Contract bytecode changed';
		}

		deploymentInfo[moduleName] = info;

		if (info.needsDeployment) {
			deploymentInfo.deploymentsNeeded.push(moduleName);
		}
	}

	return deploymentInfo;
}

async function _printAndConfirm({ deploymentInfo }) {
	const numDeployments = deploymentInfo.deploymentsNeeded.length;

	// Print out summary of what needs to be done
	logger.log(chalk[numDeployments > 0 ? 'green' : 'gray'](`Deployments needed: ${numDeployments}`));
	if (numDeployments > 0) {
		logger.log(chalk.green('Modules to deploy:'));
		deploymentInfo.deploymentsNeeded.map((moduleName) => {
			logger.log(
				chalk.green(`  > ${moduleName} - Deployment reason: ${deploymentInfo[moduleName].reason}`)
			);
		});
	}

	// Skip if nothing needs to be done
	if (numDeployments === 0) {
		return;
	}

	// Confirm
	await prompter.confirmAction(`Deploy these ${deploymentInfo.deploymentsNeeded.length} modules`);
}

async function _deployModules({ deploymentInfo, deploymentData, sourceModules, hre }) {
	// Deploy the modules
	let numDeployedModules = 0;
	for (let moduleName of sourceModules) {
		const moduleData = deploymentData.modules[moduleName];

		logger.log(chalk.gray(`> ${moduleName}`), 2);

		const info = deploymentInfo[moduleName];
		if (info.needsDeployment) {
			logger.log(chalk.yellow(`Deploying ${moduleName}...`), 1);

			const factory = await hre.ethers.getContractFactory(moduleName);
			const module = await factory.deploy();

			if (!module.address) {
				throw new Error(`Error deploying ${moduleName}`);
			}

			numDeployedModules++;

			logger.log(chalk.green(`Deployed ${moduleName} to ${module.address}`), 1);

			moduleData.deployedAddress = module.address;

			const sourceBytecodeHash = _getContractBytecodeHash({ moduleName, hre });
			moduleData.bytecodeHash = sourceBytecodeHash;
		} else {
			logger.log(chalk.gray(`No need to deploy ${moduleName}`), 2);
		}
	}

	logger.log(
		chalk[numDeployedModules > 0 ? 'green' : 'gray'](`Deployed modules: ${numDeployedModules}`)
	);
}

function _getContractBytecodeHash({ moduleName, hre }) {
	const file = fs.readFileSync(`artifacts/contracts/modules/${moduleName}.sol/${moduleName}.json`);
	const data = JSON.parse(file);

	return hre.ethers.utils.sha256(data.bytecode);
}
