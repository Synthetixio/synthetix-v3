const logger = require('../utils/logger');
const prompter = require('../utils/prompter');
const chalk = require('chalk');
const { readDeploymentFile } = require('../utils/deploymentFile');
const { getContractBytecodeHash } = require('../utils/getBytecodeHash');
const { subtask } = require('hardhat/config');
const { TASK_COMPILE } = require('hardhat/builtin-tasks/task-names');
const { SUBTASK_DEPLOY_CONTRACT, SUBTASK_DEPLOY_ROUTER } = require('../task-names');

let _hre;

/*
 * Deploys the system router, if needed.
 * */
subtask(SUBTASK_DEPLOY_ROUTER).setAction(async (_, hre) => {
  _hre = hre;

  const routerName = `Router_${hre.network.name}`;
  logger.log(chalk.cyan('Checking router for deployment'));
  await hre.run(TASK_COMPILE, { force: false });

  const data = readDeploymentFile({ hre });
  if (_isDeploymentNeeded({ data, routerName })) {
    await prompter.confirmAction(`Deploy ${routerName}`);

    await hre.run(SUBTASK_DEPLOY_CONTRACT, { contractName: routerName });
  } else {
    logger.log(chalk.gray(`No need to deploy ${routerName}`), 1);
  }
});

function _isDeploymentNeeded({ data, routerName }) {
  let needsDeployment = false;
  let reason = '';

  if (data[routerName]) {
    const sourceBytecodeHash = getContractBytecodeHash({
      contractName: routerName,
      hre: _hre,
    });

    const storedBytecodeHash = data[routerName].bytecodeHash;
    const bytecodeChanged = sourceBytecodeHash !== storedBytecodeHash;
    if (bytecodeChanged) {
      reason = 'bytecode changed';
      needsDeployment = true;
    }
  } else {
    reason = 'no previous deployment found';
    needsDeployment = true;
  }

  logger.log(chalk.yellow(`  > ${routerName} needs deployment - reason: ${reason}`), 1);

  return needsDeployment;
}
