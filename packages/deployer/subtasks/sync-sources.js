const { subtask } = require('hardhat/config');
const logger = require('@synthetixio/core-js/utils/logger');
const prompter = require('@synthetixio/core-js/utils/prompter');
const { getModulesPaths } = require('../internal/path-finder');
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

  const { data, previousData } = hre.deployer;
  const sources = getModulesPaths(hre.config);

  const removed = await _removeDeletedSources({ sources, previousData });
  const added = await _addNewSources({ sources, data, previousData });

  if (!removed && !added) {
    logger.checked('Deployment data is in sync with sources');
  }
});

async function _removeDeletedSources({ sources, previousData }) {
  if (!previousData) return false;

  const modulesPaths = Object.entries(previousData.contracts)
    .filter(([, c]) => c.isModule)
    .map(([modulePath]) => modulePath);

  const toRemove = modulesPaths.filter(
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

const _createModuleData = () => ({
  isModule: true,
  deployedAddress: '',
  deployTransaction: '',
  bytecodeHash: '',
});

async function _addNewSources({ sources, data, previousData }) {
  let created = false;

  // Initialize cotract data, using previous deployed one, or empty data.
  for (const source of sources) {
    const previousModule = previousData?.contracts[source];

    data.contracts[source] = data.contracts[source] || previousModule || _createModuleData();

    if (!previousModule) created = true;
  }

  return created;
}
