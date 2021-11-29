const { task } = require('hardhat/config');

const { SUBTASK_PICK_CONTRACT, TASK_INTERACT } = require('../task-names');

task(TASK_INTERACT, 'Interacts with a given modular system deployment')
  .addOptionalParam('deploymentPath', 'Specify the path to the deployment data directory')
  .setAction(async (taskArguments, hre) => {
    await hre.run(SUBTASK_PICK_CONTRACT, taskArguments);
  });
