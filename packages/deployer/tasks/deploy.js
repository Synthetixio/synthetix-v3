const { task } = require('hardhat/config');
const { DEPLOY_TASK, DEPLOY_MODULES_SUBTASK } = require('../task-names');

task(
  DEPLOY_TASK,
  'Deploys all modules that changed, and generates and deploys a router for those modules'
).setAction(async (taskArguments, hre) => {
  console.log('deploying...');

  await hre.run(DEPLOY_MODULES_SUBTASK, taskArguments);
});
