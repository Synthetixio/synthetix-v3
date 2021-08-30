const { task } = require('hardhat/config');

const {
  TASK_DEPLOY,
} = require('../task-names');

task(TASK_DEPLOY, 'Deploys all system modules')
  .setAction(async (taskArguments, hre) => {
    console.log('hello');
  });
