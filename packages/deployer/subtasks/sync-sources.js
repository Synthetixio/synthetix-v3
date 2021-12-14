const path = require('path');
const filterValues = require('filter-values');
const { subtask } = require('hardhat/config');
const logger = require('@synthetixio/core-js/utils/io/logger');
const prompter = require('@synthetixio/core-js/utils/io/prompter');
const { getModulesPaths } = require('../internal/contract-helper');
const { initContractData } = require('../internal/process-contracts');
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

  const { previousDeployment } = hre.deployer;
  const sources = await getModulesPaths(hre.config);

  const removed = await _removeDeletedSources({ sources, previousDeployment });
  const added = await _addNewSources({ sources, previousDeployment });

  if (!removed && !added) {
    logger.checked('Deployment data is in sync with sources');
  }
});

async function _removeDeletedSources({ sources, previousDeployment }) {
  if (!previousDeployment) return false;

  const modules = filterValues(previousDeployment.general.contracts, (c) => c.isModule);
  const modulesPaths = Object.values(modules).map((c) => c.sourceName);

  const toRemove = modulesPaths.filter(
    (deployedModule) => !sources.some((source) => deployedModule === source)
  );

  if (toRemove.length > 0) {
    logger.notice(
      'The following modules are not present in sources anymore, they will not be included on the deployment:'
    );
    toRemove.forEach((source) => logger.notice(source));
    await prompter.confirmAction('Do you confirm removing these modules?');
  }

  return toRemove.length > 0;
}

async function _addNewSources({ sources, previousDeployment }) {
  const toAdd = [];

  // Initialize cotract data, using previous deployed one, or empty data.
  for (const source of sources) {
    const contractName = path.basename(source, '.sol');

    await initContractData(contractName);

    if (!previousDeployment?.general.contracts[contractName]) {
      toAdd.push(source);
    }
  }

  if (toAdd.length > 0) {
    logger.notice('The following modules are going to be deployed for the first time:');
    toAdd.forEach((source) => logger.notice(source));
  }

  return toAdd.length > 0;
}
