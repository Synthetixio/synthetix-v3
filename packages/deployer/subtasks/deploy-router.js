const logger = require('@synthetixio/core-js/utils/logger');
const path = require('path');
const { subtask } = require('hardhat/config');
const { TASK_COMPILE } = require('hardhat/builtin-tasks/task-names');
const { getRouterName } = require('../utils/router');
const relativePath = require('@synthetixio/core-js/utils/relative-path');

const { SUBTASK_DEPLOY_CONTRACT, SUBTASK_DEPLOY_ROUTER } = require('../task-names');

subtask(SUBTASK_DEPLOY_ROUTER).setAction(async ({ instance }, hre) => {
  logger.subtitle('Deploying router');

  await hre.run(TASK_COMPILE, { force: false, quiet: true });

  const contractPath = path.join(
    relativePath(hre.config.paths.sources, hre.config.paths.root),
    getRouterName({ network: hre.network.name, instance })
  );

  let contractData = hre.deployer.data.contracts[contractPath];

  if (!contractData) {
    hre.deployer.data.contracts[contractPath] = {
      deployedAddress: '',
      deployTransaction: '',
      bytecodeHash: '',
    };
    contractData = hre.deployer.data.contracts[contractPath];
  }

  await hre.run(SUBTASK_DEPLOY_CONTRACT, {
    contractPath,
    contractData,
  });
});
