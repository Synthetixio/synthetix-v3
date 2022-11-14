const { subtask } = require('hardhat/config');
const { default: logger } = require('@synthetixio/core-utils/utils/io/logger');
const { default: prompter } = require('@synthetixio/core-utils/utils/io/prompter');
const { getModulesFullyQualifiedNames, getStorageLibrariesFullyQualifiedNames } = require('../internal/contract-helper');
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
).setAction(async ({ modules }, hre) => {
  logger.subtitle('Syncing solidity sources with deployment data');

  const { previousDeployment } = hre.router;
  const modulesFullyQualifiedNames = await getModulesFullyQualifiedNames(
    modules ? new RegExp(modules) : /.*/,
    hre
  );

  const storageLibrariesFullyQualifiedNames = await getStorageLibrariesFullyQualifiedNames(
    hre
  )

  const removed = await _removeDeletedSources({ modulesFullyQualifiedNames, storageLibrariesFullyQualifiedNames, previousDeployment });
  const added = await _addNewSources({ modulesFullyQualifiedNames, storageLibrariesFullyQualifiedNames, previousDeployment });

  if (!removed && !added) {
    logger.checked('Deployment data is in sync with sources');
  }
});

async function _removeDeletedSources({ modulesFullyQualifiedNames, storageLibrariesFullyQualifiedNames, previousDeployment }) {
  if (!previousDeployment) return false;

  const previousFullyQualifiedNames = Object.entries(previousDeployment.general.contracts)
    .filter(([, contractAttributes]) => contractAttributes.isModule)
    .map(([fullyQualifiedName]) => fullyQualifiedName);

  const toRemove = previousFullyQualifiedNames.filter(
    (name) => !modulesFullyQualifiedNames.includes(name) && !storageLibrariesFullyQualifiedNames.includes(name)
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

async function _addNewSources({ modulesFullyQualifiedNames, storageLibrariesFullyQualifiedNames, previousDeployment }) {
  const toAdd = [];

  // Initialize cotract data, using previous deployed one, or empty data.
  for (const moduleFullyQualifiedName of modulesFullyQualifiedNames) {
    await initContractData(moduleFullyQualifiedName, { isModule: true });

    if (!previousDeployment?.general.contracts[moduleFullyQualifiedName]) {
      toAdd.push(moduleFullyQualifiedName);
    }
  }

  for (const storageLibraryFullyQualifiedName of storageLibrariesFullyQualifiedNames) {
    await initContractData(storageLibraryFullyQualifiedName, { isStorageLibrary: true });

    if (!previousDeployment?.general.contracts[storageLibraryFullyQualifiedName]) {
      toAdd.push(storageLibraryFullyQualifiedName);
    }
  }

  if (toAdd.length > 0) {
    logger.notice('The following modules/storage libraries have been deployed for the first time:');
    toAdd.forEach((name) => logger.notice(`  ${name}`));
  }

  return toAdd.length > 0;
}
