const logger = require('@synthetixio/core-js/utils/logger');
const { subtask } = require('hardhat/config');
const { initContractData } = require('../internal/process-contracts');

const { SUBTASK_DEPLOY_CONTRACT, SUBTASK_DEPLOY_ROUTER } = require('../task-names');

subtask(SUBTASK_DEPLOY_ROUTER).setAction(async (_, hre) => {
  logger.subtitle('Deploying router');

  const contractName = 'Router';

  await initContractData(contractName);

  const deployedSomething = await hre.run(SUBTASK_DEPLOY_CONTRACT, { contractName });

  if (!deployedSomething) {
    logger.checked('The router does not need to be deployed');
  }
});
