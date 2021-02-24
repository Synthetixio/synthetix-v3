const logger = require('../utils/logger');
const prompter = require('../utils/prompter');
const { subtask } = require('hardhat/config');
const { saveDeploymentFile } = require('../utils/deploymentFile');
const { SUBTASK_SYNC_SOURCES } = require('../task-names');

/*
 * Synchronizes the deployment file with the latest module sources.
 * I.e. if a module was removed from the sources, the associated entry
 * is deleted from the deployment file, and viceversa.
 * */
subtask(SUBTASK_SYNC_SOURCES).setAction(async (_, hre) => {
  logger.subtitle('Syncing solidity sources with deployment data');

  const data = hre.deployer.data;
  const sources = hre.deployer.sources;

  const someDeletion = await _removeDeletedSources({ data, sources });
  const someAddition = await _addNewSources({ data, sources });

  if (!someDeletion && !someAddition) {
    logger.checked('✓ Deployment data is in sync with sources');
  }

  saveDeploymentFile({ data, hre });
});

async function _removeDeletedSources({ data, sources }) {
  let someDeletion = false;

  Object.keys(data.modules).map((deployedModule) => {
    if (!sources.some((source) => deployedModule === source)) {
      logger.notice(
        `Previously deployed module "${deployedModule}" was not found in sources, so it will not be included in the deployment`
      );

      someDeletion = true;

      delete data.modules[deployedModule];
    }
  });

  if (someDeletion) {
    await prompter.confirmAction('Do you confirm removing these modules');
  }

  return someDeletion;
}

async function _addNewSources({ data, sources }) {
  let someAddition = false;

  sources.map((source) => {
    if (!data.modules[source]) {
      logger.notice(`Found new module "${source}", including it for deployment`);

      someAddition = true;

      data.modules[source] = {
        deployedAddress: '',
        bytecodeHash: '',
      };
    }
  });

  if (someAddition) {
    await prompter.confirmAction('Do you confirm these new modules');
  }

  return someAddition;
}
