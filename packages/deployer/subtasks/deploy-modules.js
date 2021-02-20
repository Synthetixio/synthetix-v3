const logger = require('../utils/logger');
const prompter = require('../utils/prompter');
const chalk = require('chalk');
const { subtask } = require('hardhat/config');
const { readDeploymentFile } = require('../utils/deploymentFile');
const { getSourceModules } = require('../utils/getSourceModules');
const { getContractBytecodeHash } = require('../utils/getBytecodeHash');
const { SUBTASK_DEPLOY_MODULES, SUBTASK_DEPLOY_CONTRACT } = require('../task-names');

let _hre;

/*
 * Deploys all modules found in sources, and stores
 * the new addresses and associated data in the deployment file.
 * */
subtask(SUBTASK_DEPLOY_MODULES).setAction(async ({ force }, hre) => {
  _hre = hre;

  logger.log(chalk.cyan('Deploying modules'));

  const data = readDeploymentFile({ hre });
  const sources = getSourceModules({ hre });

  const deploymentInfo = await _getDeploymentInfo({ force, data, sources });
  await _printAndConfirm({ deploymentInfo });
  await _deployModules({ deploymentInfo, sources });
});

async function _getDeploymentInfo({ force, data, sources }) {
  const deploymentInfo = {
    deploymentsNeeded: [],
  };

  for (let moduleName of sources) {
    const moduleData = data.modules[moduleName];

    const info = {};

    if (!info.needsDeployment && force) {
      info.needsDeployment = true;
      info.reason = '--force is true';
    }

    if (!info.eedsDeployment && _hre.network.name === 'hardhat') {
      info.needsDeployment = true;
      info.reason = 'Always deploy in hardhat network';
    }

    if (!info.needsDeployment && !moduleData.deployedAddress) {
      info.needsDeployment = true;
      info.reason = 'No deployed address found';
    }

    const sourceBytecodeHash = getContractBytecodeHash({
      contractName: moduleName,
      isModule: true,
      hre: _hre,
    });
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

async function _deployModules({ deploymentInfo, sources }) {
  // Deploy the modules
  let numDeployedModules = 0;
  for (let moduleName of sources) {
    const info = deploymentInfo[moduleName];

    if (info.needsDeployment) {
      await _hre.run(SUBTASK_DEPLOY_CONTRACT, { contractName: moduleName, isModule: true });

      numDeployedModules++;
    } else {
      logger.log(chalk.gray(`No need to deploy ${moduleName}`), 2);
    }
  }

  logger.log(
    chalk[numDeployedModules > 0 ? 'green' : 'gray'](`Deployed modules: ${numDeployedModules}`)
  );
}
