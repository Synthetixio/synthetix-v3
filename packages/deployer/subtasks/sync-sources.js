const { subtask } = require('hardhat/config');
const logger = require('@synthetixio/core-js/utils/io/logger');
const prompter = require('@synthetixio/core-js/utils/io/prompter');
const { getModulesFullyQualifiedNames } = require('../internal/contract-helper');
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
  const modulesFullyQualifiedNames = await getModulesFullyQualifiedNames();

  const removed = await _removeDeletedSources({ modulesFullyQualifiedNames, previousDeployment });
  const added = await _addNewSources({ modulesFullyQualifiedNames, previousDeployment });

  if (!removed && !added) {
    logger.checked('Deployment data is in sync with sources');
  }
});

async function _removeDeletedSources({ modulesFullyQualifiedNames, previousDeployment }) {
  if (!previousDeployment) return false;

  const previousModulesFullyQualifiedNames = Object.entries(previousDeployment.general.contracts)
    .filter(([, contractAttributes]) => contractAttributes.isModule)
    .map(([fullyQualifiedName]) => fullyQualifiedName);

  const toRemove = previousModulesFullyQualifiedNames.filter(
    (name) => !modulesFullyQualifiedNames.includes(name)
  );

  if (toRemove.length > 0) {
    logger.notice(
      'The following modules are not present in sources anymore, they will not be included on the deployment:'
    );
    toRemove.forEach((name) => logger.notice(`  ${name}`));
    await prompter.confirmAction('Do you confirm removing these modules?');
  }

  return toRemove.length > 0;
}

async function _addNewSources({ modulesFullyQualifiedNames, previousDeployment }) {
  const toAdd = [];

  // Initialize cotract data, using previous deployed one, or empty data.
  for (const moduleFullyQualifiedName of modulesFullyQualifiedNames) {
    await initContractData(moduleFullyQualifiedName);

    if (!previousDeployment?.general.contracts[moduleFullyQualifiedName]) {
      toAdd.push(moduleFullyQualifiedName);
    }
  }

  if (toAdd.length > 0) {
    logger.notice('The following modules are going to be deployed for the first time:');
    toAdd.forEach((name) => logger.notice(`  ${name}`));
  }

  return toAdd.length > 0;
}
