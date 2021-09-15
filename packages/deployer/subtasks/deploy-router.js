const logger = require('@synthetixio/core-js/utils/logger');
const { subtask } = require('hardhat/config');
const { TASK_COMPILE } = require('hardhat/builtin-tasks/task-names');
const { initContractData } = require('../internal/process-contracts');

const { SUBTASK_DEPLOY_CONTRACT, SUBTASK_DEPLOY_ROUTER } = require('../task-names');

subtask(SUBTASK_DEPLOY_ROUTER).setAction(async (_, hre) => {
  logger.subtitle('Deploying router');

  await hre.run(TASK_COMPILE, { force: false, quiet: true });

  const contractName = 'Router';

  if (!hre.deployer.deployment.data.contracts[contractName]) {
    await initContractData(contractName);
  }

  await hre.run(SUBTASK_DEPLOY_CONTRACT, { contractName });
});
