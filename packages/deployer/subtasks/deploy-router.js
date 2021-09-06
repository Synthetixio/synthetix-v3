const logger = require('../utils/logger');
const { subtask } = require('hardhat/config');
const { TASK_COMPILE } = require('hardhat/builtin-tasks/task-names');

const { SUBTASK_DEPLOY_CONTRACTS, SUBTASK_DEPLOY_ROUTER } = require('../task-names');

subtask(SUBTASK_DEPLOY_ROUTER).setAction(async (_, hre) => {
  logger.subtitle('Deploying router');

  await hre.run(TASK_COMPILE, { force: false, quiet: true });

  await hre.run(SUBTASK_DEPLOY_CONTRACTS, {
    contracts: { [hre.deployer.paths.routerPath]: {} },
  });
});
