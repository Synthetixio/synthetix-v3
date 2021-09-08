const { subtask } = require('hardhat/config');
const logger = require('../utils/logger');
const prompter = require('../utils/prompter');
const { getModulesPaths } = require('../utils/deployments');
const { SUBTASK_SYNC_SOURCES } = require('../task-names');

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

  hre.deployer.sources = getModulesPaths(hre.config.deployer.paths.modules);

  const { data, sources, previousData } = hre.deployer;
  const removed = await _removeDeletedSources({ sources, previousData });
  const added = await _addNewSources({ sources, data, previousData });

  if (!removed && !added) {
    logger.checked('Deployment data is in sync with sources');
  }
});

async function _removeDeletedSources({ sources, previousData }) {
  if (!previousData) return false;

  const toRemove = Object.keys(previousData.contracts.modules).filter(
    (deployedModule) => !sources.some((source) => deployedModule === source)
  );

  if (toRemove.length > 0) {
    logger.notice(
      'The following modules are not present in sources anymore, they will not be included on the deployment:'
    );
    toRemove.forEach((source) => logger.notice(`  ${source}`));
    await prompter.confirmAction('Do you confirm removing these modules?');
  }

  return toRemove.length > 0;
}

async function _addNewSources({ sources, data, previousData }) {
  const toAdd = sources.filter((source) => {
    const previousModule = previousData?.contracts.modules[source];
    data.contracts.modules[source] = data.contracts.modules[source] ||
      previousModule || { deployedAddress: '', deployTransaction: '', bytecodeHash: '' };
    return !previousModule;
  });

  return toAdd.length > 0;
}
