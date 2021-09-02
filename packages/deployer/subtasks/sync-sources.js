const fs = require('fs');
const path = require('path');
const glob = require('glob');
const { subtask } = require('hardhat/config');
const logger = require('../utils/logger');
const prompter = require('../utils/prompter');
const { SUBTASK_SYNC_SOURCES } = require('../task-names');
const relativePath = require('../utils/relative-path');

/**
 * Synchronizes the deployment file with the latest module sources.
 * I.e. if a module was removed from the sources, the associated entry
 * is deleted from the deployment file, and viceversa.
 */
subtask(
  SUBTASK_SYNC_SOURCES,
  'Synchronizes the deployment file with the latest module sources.'
).setAction(async (_, hre) => {
  logger.subtitle('Syncing solidity sources with deployment data');

  hre.deployer.sources = glob
    .sync(path.join(hre.deployer.paths.modules, '**/*.sol'))
    .map(relativePath);

  const { data, sources } = hre.deployer;
  const someDeletion = await _removeDeletedSources({ data, sources });
  const someAddition = await _addNewSources({ data, sources });

  if (!someDeletion && !someAddition) {
    logger.checked('Deployment data is in sync with sources');
  }
});

async function _removeDeletedSources({ data, sources }) {
  let someDeletion = false;

  Object.keys(data.contracts.modules).map((deployedModule) => {
    if (!sources.some((source) => deployedModule === source)) {
      logger.notice(
        `Previously deployed module "${deployedModule}" was not found in sources, so it will not be included in the deployment`
      );

      someDeletion = true;

      delete data.contracts.modules[deployedModule];
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
    if (!data.contracts.modules[source]) {
      logger.notice(`Found new module "${source}", including it for deployment`);

      someAddition = true;

      data.contracts.modules[source] = {
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
