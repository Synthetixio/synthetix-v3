const { task } = require('hardhat/config');

const {
  SUBTASK_GENERATE_IMC_SOURCE,
  SUBTASK_SYNC_SOURCES,
  TASK_DUMMY_IMC,
} = require('../task-names');
const logger = require('../utils/logger');
const prompter = require('../utils/prompter');
const { getDeploymentPaths } = require('../utils/deployments');

task(TASK_DUMMY_IMC, 'Deploys all system modules')
  .addFlag('noConfirm', 'Skip all confirmation prompts', false)
  .addFlag('debug', 'Display debug logs', false)
  .setAction(async (taskArguments, hre) => {
    const { debug, noConfirm } = taskArguments;

    logger.debugging = debug;
    prompter.noConfirm = noConfirm;

    hre.deployer.imcMixinModule = 'GenIMCMixin';

    hre.deployer.paths = getDeploymentPaths();

    hre.deployer.data = { contracts: { modules: {} } };
    await hre.run(SUBTASK_SYNC_SOURCES);
    await hre.run(SUBTASK_GENERATE_IMC_SOURCE, { dummyImc: true });
  });
