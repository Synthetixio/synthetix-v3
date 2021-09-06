const logger = require('../utils/logger');
const { subtask } = require('hardhat/config');
const { TASK_COMPILE } = require('hardhat/builtin-tasks/task-names');

const { SUBTASK_DEPLOY_CONTRACT, SUBTASK_DEPLOY_ROUTER } = require('../task-names');

subtask(SUBTASK_DEPLOY_ROUTER).setAction(async (_, hre) => {
  logger.subtitle('Deploying router');

  await hre.run(TASK_COMPILE, { force: false, quiet: true });

  const contractPath = hre.deployer.paths.routerPath;
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
