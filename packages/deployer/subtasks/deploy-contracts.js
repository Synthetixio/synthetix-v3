const logger = require('../utils/logger');
const prompter = require('../utils/prompter');
const { processContracts } = require('../utils/contracts');
const { subtask } = require('hardhat/config');
const { SUBTASK_DEPLOY_CONTRACTS, SUBTASK_DEPLOY_CONTRACT } = require('../task-names');

subtask(
  SUBTASK_DEPLOY_CONTRACTS,
  'Deploys a list of contracts, avoiding contracts that do not need to be deployed, and prompting the user for confirmation.'
).setAction(async ({ contracts }, hre) => {
  const { toSkip, toUpdate, toCreate } = await processContracts(contracts);

  if (toUpdate.length === 0 && toCreate.length === 0) {
    logger.info('No contracts need to be deployed, continuing...');
    return;
  } else {
    await _confirmDeployments({ toSkip, toUpdate, toCreate });
  }

  // Update & create the contracts
  for (const [contractPath, contractData] of [...toUpdate, ...toCreate]) {
    await hre.run(SUBTASK_DEPLOY_CONTRACT, {
      contractPath,
      contractData,
    });
  }
});

/**
 * Prompts the user to confirm the give deployments if necessary
 */
async function _confirmDeployments({ toSkip, toUpdate, toCreate }) {
  if (toSkip.length > 0) {
    logger.info(`There are ${toSkip.length} contracts that are already up-to-date:`);
    toSkip.forEach(([source]) => logger.notice(`  ${source}`));
  }

  if (toUpdate.length > 0) {
    logger.info(`The following ${toUpdate.length} contracts are going to be updated:`);
    toUpdate.forEach(([source]) => logger.notice(`  ${source}`));
  }

  if (toCreate.length > 0) {
    logger.info(
      `The following ${toCreate.length} contracts are going to be deployed for the first time:`
    );
    toCreate.forEach(([source]) => logger.notice(`  ${source}`));
  }

  await prompter.confirmAction('Are you sure you want to make these changes?');
}
