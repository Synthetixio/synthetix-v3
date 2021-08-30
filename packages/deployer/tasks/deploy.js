const { task } = require('hardhat/config');

const {
  TASK_DEPLOY,
} = require('../task-names');

task(TASK_DEPLOY, 'Deploys all system modules')
	.addOptionalParam('instance', 'The name of the target instance for deployment', 'official')
  .setAction(async (taskArguments, hre) => {
    const { instance } = taskArguments;

    console.log(`Network: ${hre.network.name}, Instance: ${instance}`);
  });
