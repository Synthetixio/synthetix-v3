const logger = require('@synthetixio/core-js/utils/logger');
const prompter = require('@synthetixio/core-js/utils/prompter');
const { isAlreadyDeployed } = require('../internal/contract-helper');
const { subtask } = require('hardhat/config');
const { SUBTASK_DEPLOY_CONTRACTS, SUBTASK_DEPLOY_CONTRACT } = require('../task-names');

subtask(
  SUBTASK_DEPLOY_CONTRACTS,
  'Deploys a list of contracts, avoiding contracts that do not need to be deployed, and prompting the user for confirmation.'
).setAction(async ({ contracts }, hre) => {
  const { toSkip, toUpdate, toCreate } = await _processContracts(contracts);

  if (toUpdate.length === 0 && toCreate.length === 0) {
    return false;
  } else {
    const yes = await _confirmDeployments({ toSkip, toUpdate, toCreate });
    if (!yes) return false;
  }

  // Update & create the contracts
  for (const contractName of [...toUpdate, ...toCreate]) {
    await hre.run(SUBTASK_DEPLOY_CONTRACT, {
      contractName,
      requireConfirmation: false,
    });
  }

  return true;
});

/**
 * Prompts the user to confirm the give deployments if necessary
 */
async function _confirmDeployments({ toSkip, toUpdate, toCreate }) {
  if (toSkip.length > 0) {
    logger.info(`There are ${toSkip.length} contracts that are already up-to-date:`);
    toSkip.forEach((contractName) => logger.notice(`  ${contractName}`));
  }

  if (toUpdate.length > 0) {
    logger.info(`The following ${toUpdate.length} contracts are going to be updated:`);
    toUpdate.forEach((contractName) => logger.notice(`  ${contractName}`));
  }

  if (toCreate.length > 0) {
    logger.info(
      `The following ${toCreate.length} contracts are going to be deployed for the first time:`
    );
    toCreate.forEach((contractName) => logger.notice(`  ${contractName}`));
  }

  return await prompter.ask('Are you sure you want to make these changes?');
}

/**
 * Sort contracts by the ones that doesn't need deployment, the ones that are going
 * to be re-deployed with updated code, and the ones that are going to be deployed
 * for the first time.
 */
async function _processContracts(contracts) {
  const toSkip = [];
  const toUpdate = [];
  const toCreate = [];

  for (const [contractName, contractData] of Object.entries(contracts)) {
    if (!contractData.deployedAddress) {
      toCreate.push(contractName);
    } else {
      if (await isAlreadyDeployed(contractName, contractData)) {
        toSkip.push(contractName);
      } else {
        toUpdate.push(contractName);
      }
    }
  }

  return { toSkip, toUpdate, toCreate };
}
