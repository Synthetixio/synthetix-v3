const path = require('path');
const { TASK_DEPLOY } = require('@synthetixio/deployer/task-names');

module.exports = function bootstrap() {
  const deploymentInfo = {
    network: 'hardhat',
    instance: 'fixture',
    folder: path.resolve(__dirname, '..', '..', 'deployments'),
  };

  before('loading environment', async function () {
    this.timeout(25000);

    // Do a first deployment of the project
    await hre.run(TASK_DEPLOY, {
      ...deploymentInfo,
      clear: true,
      noConfirm: true,
      quiet: true,
      debug: false,
    });
  });

  return { deploymentInfo };
};
