const logger = require('@synthetixio/core-js/utils/logger');
const path = require('path');
const { subtask } = require('hardhat/config');
const { TASK_COMPILE } = require('hardhat/builtin-tasks/task-names');
const relativePath = require('@synthetixio/core-js/utils/relative-path');

const { SUBTASK_DEPLOY_CONTRACT, SUBTASK_DEPLOY_ROUTER } = require('../task-names');

subtask(SUBTASK_DEPLOY_ROUTER).setAction(async (_, hre) => {
  logger.subtitle('Deploying router');

  await hre.run(TASK_COMPILE, { force: false, quiet: true });

  const contractName = 'Router';
  const conntractPath = path.join(
    relativePath(hre.config.paths.sources, hre.config.paths.root),
    `${contractName}.sol`
  );

  let contractData = hre.deployer.data.contracts[contractName];

  if (!contractData) {
    hre.deployer.data.contracts[contractName] = {
      source: conntractPath,
      deployedAddress: '',
      deployTransaction: '',
      bytecodeHash: '',
    };
    contractData = hre.deployer.data.contracts[contractName];
  }

  await hre.run(SUBTASK_DEPLOY_CONTRACT, {
    contractName,
    contractData,
  });
});
