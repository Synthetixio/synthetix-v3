const { subtask } = require('hardhat/config');

subtask('deploy-modules').setAction(async (taskArguments, hre) => {
  console.log('deploying modules...');

  console.log(hre.config.deployer);
});
