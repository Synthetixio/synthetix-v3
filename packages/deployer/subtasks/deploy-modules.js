const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const prompter = require('../utils/prompter');
const chalk = require('chalk');
const ethers = require('ethers');
const { subtask } = require('hardhat/config');
const { readDeploymentFile, saveDeploymentFile } = require('../utils/deploymentFile');
const { SUBTASK_DEPLOY_MODULES } = require('../task-names');

subtask(SUBTASK_DEPLOY_MODULES).setAction(async () => {
  logger.log(chalk.cyan('Deploying modules...'));

  const deploymentData = _getDeploymentData();
  const sourceModules = _getSourceModules();

  _cleanupModules({ deploymentData, sourceModules });

  await _deployModules({ deploymentData, sourceModules });

  _saveDeploymentData({ deploymentData });
});

async function _deployModules({ deploymentData, sourceModules }) {
  // Collect info about which modules need to be deployed
  const deployInfo = {
    deploymentsNeeded: [],
  };
  for (let moduleName of sourceModules) {
    const moduleData = deploymentData.modules[moduleName];

    const info = {};

    let needsDeployment = false;

    // eslint-disable-next-line no-undef
    if (!needsDeployment && hre.network.name === 'hardhat') {
      info.needsDeployment = true;
      info.reason = 'Always deploy in hardhat network';
    }

    if (!needsDeployment && !moduleData.deployedAddress) {
      info.needsDeployment = true;
      info.reason = 'No address found';
    }

    const sourceBytecodeHash = _getModuleBytecodeHash(moduleName);
    const storedBytecodeHash = moduleData.bytecodeHash;
    const bytecodeChanged = sourceBytecodeHash !== storedBytecodeHash;
    if (!needsDeployment && bytecodeChanged) {
      info.needsDeployment = true;
      info.reason = 'Bytecode changed';
    }

    deployInfo[moduleName] = info;

    if (info.needsDeployment) {
      deployInfo.deploymentsNeeded.push(moduleName);
    }
  }

  const numDeployments = deployInfo.deploymentsNeeded.length;

  // Print out summary of what needs to be done
  logger.log(chalk[numDeployments > 0 ? 'green' : 'gray'](`Deployments needed: ${numDeployments}`));
  if (numDeployments > 0) {
    logger.log(chalk.green('Modules to deploy:'));
    deployInfo.deploymentsNeeded.map((moduleName) => {
      logger.log(chalk.green(`  > ${moduleName} (${deployInfo[moduleName].reason})`));
    });
  }

  // Skip if nothing needs to be done
  if (numDeployments === 0) {
    return;
  }

  // Confirm
  if (!prompter.noConfirm) {
    await prompter.confirmAction({
      message: `Deploy ${deployInfo.deploymentsNeeded.length} modules`,
    });
  }

  // Deploy the modules
  let numDeployedModules = 0;
  for (let moduleName of sourceModules) {
    const moduleData = deploymentData.modules[moduleName];

    logger.log(chalk.gray(`> ${moduleName}`), 2);

    const info = deployInfo[moduleName];
    if (info.needsDeployment) {
      logger.log(chalk.yellow(`Deploying ${moduleName}...`), 1);

      const factory = await ethers.getContractFactory(moduleName);
      const module = await factory.deploy();

      if (!module.address) {
        throw new Error(`Error deploying ${moduleName}`);
      }

      numDeployedModules++;

      logger.log(chalk.green(`Deployed ${moduleName} to ${module.address}`), 1);

      moduleData.deployedAddress = module.address;

      const sourceBytecodeHash = _getModuleBytecodeHash(moduleName);
      moduleData.bytecodeHash = sourceBytecodeHash;
    } else {
      logger.log(chalk.gray(`No need to deploy ${moduleName}`), 2);
    }
  }

  logger.log(
    chalk[numDeployedModules > 0 ? 'green' : 'gray'](`Deployed modules: ${numDeployedModules}`)
  );
}

function _getModuleBytecodeHash(moduleName) {
  const file = fs.readFileSync(`artifacts/contracts/modules/${moduleName}.sol/${moduleName}.json`);
  const data = JSON.parse(file);

  return ethers.utils.sha256(data.bytecode);
}

function _saveDeploymentData({ deploymentData }) {
  const commitHash = _getGitCommitHash();

  const deploymentFile = readDeploymentFile();
  deploymentFile[commitHash] = deploymentData;

  saveDeploymentFile({ data: deploymentFile });
}

// Retrieve saved data about this deployment.
// Note: Deployments are tracked by the hash of the current
// commit in the source code.
function _getDeploymentData() {
  const commitHash = _getGitCommitHash();

  const deploymentFile = readDeploymentFile();
  if (!deploymentFile[commitHash]) {
    deploymentFile[commitHash] = {};
  }

  const deploymentData = deploymentFile[commitHash];
  if (!deploymentData.modules) {
    deploymentData.modules = {};
  }

  return deploymentData;
}

// Read contracts/modules/*
function _getSourceModules() {
  // eslint-disable-next-line no-undef
  const modulesPath = hre.config.deployer.paths.modules;
  return fs.readdirSync(modulesPath).map((file) => {
    const filePath = path.parse(file);
    if (filePath.ext === '.sol') {
      return filePath.name;
    }
  });
}

// Syncs modules found in contracts/modules/*
// with entries found in deployment.modules
function _cleanupModules({ deploymentData, sourceModules }) {
  // Remove entries from the file that are not
  // included in the current sources
  Object.keys(deploymentData.modules).map((deployedModule) => {
    if (!sourceModules.some((sourceModule) => deployedModule === sourceModule)) {
      deploymentData.modules[deployedModule] = null;
    }
  });

  // Make sure all modules found in sources
  // have an entry in the file
  sourceModules.map((sourceModule) => {
    if (!deploymentData.modules[sourceModule]) {
      deploymentData.modules[sourceModule] = {
        deployedAddress: '',
        bytecodeHash: '',
      };
    }
  });
}

function _getGitCommitHash() {
  return require('child_process').execSync('git rev-parse HEAD').toString().slice(0, 40);
}
