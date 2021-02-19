const logger = require('../utils/logger');
const prompter = require('../utils/prompter');
const chalk = require('chalk');
const { subtask } = require('hardhat/config');
const { readDeploymentFile, saveDeploymentFile } = require('../utils/deploymentFile');
const { getSourceModules } = require('../utils/getSourceModules');
const { SUBTASK_SYNC_SOURCES } = require('../task-names');

subtask(SUBTASK_SYNC_SOURCES).setAction(async (_, hre) => {
  logger.log(chalk.cyan('Syncing sources'));

  const deploymentData = readDeploymentFile({ hre });
  const sourceModules = getSourceModules({ hre });

  await _removeDeletedSources({ deploymentData, sourceModules });
  await _addNewSources({ deploymentData, sourceModules });

  saveDeploymentFile({ deploymentData, hre });
});

async function _removeDeletedSources({ deploymentData, sourceModules }) {
  let someDeletion = false;

  Object.keys(deploymentData.modules).map((deployedModule) => {
    if (!sourceModules.some((sourceModule) => deployedModule === sourceModule)) {
      logger.log(
        chalk.red(
          `Previously deployed module ${deployedModule} was not found in sources, so it will not be included in the deployment`
        )
      );

      someDeletion = true;

      delete deploymentData.modules[deployedModule];
    }
  });

  if (someDeletion) {
    await prompter.confirmAction('Do you confirm removing these modules');
  }
}

async function _addNewSources({ deploymentData, sourceModules }) {
  let someAddition = false;

  sourceModules.map((sourceModule) => {
    if (!deploymentData.modules[sourceModule]) {
      logger.log(chalk.yellow(`Found new module ${sourceModule}, including it for deployment`));

      someAddition = true;

      deploymentData.modules[sourceModule] = {
        deployedAddress: '',
        bytecodeHash: '',
      };
    }
  });

  if (someAddition) {
    await prompter.confirmAction('Do you confirm these new modules');
  }
}
