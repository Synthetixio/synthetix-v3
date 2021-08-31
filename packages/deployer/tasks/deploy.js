const path = require('path');
const { task, types } = require('hardhat/config');

const { TASK_DEPLOY, SUBTASK_PREPARE_DEPLOYMENT } = require('../task-names');
const logger = require('../util/logger');
const prompter = require('../util/prompter');

task(TASK_DEPLOY, 'Deploys all system modules')
  .addFlag('noConfirm', 'Skip all confirmation prompts', false)
  .addFlag('debug', 'Display debug logs', false)
  .addFlag('clear', 'Clear all previous deployment data for the selected network', false)
  .addOptionalParam('alias', 'The alias name for the deployment')
  .addOptionalParam(
    'instance',
    'The name of the target instance for deployment',
    'official',
    types.string
  )
  .setAction(async (taskArguments, hre) => {
    const { instance, debug, noConfirm } = taskArguments;

    logger.debugging = debug;
    prompter.noConfirm = noConfirm;

    if (!/[a-z]+/.test(instance)) {
      throw new Error('Invalid --instance parameter value, it can only be a lowercase word');
    }

    const { paths } = hre.deployer;

    paths.deployments = path.resolve(hre.config.paths.root, hre.config.deployer.paths.deployments);
    paths.network = path.join(paths.deployments, hre.network.name);
    paths.instance = path.join(paths.network, instance);
    paths.extended = path.join(paths.instance, 'extended');

    await hre.run(SUBTASK_PREPARE_DEPLOYMENT, taskArguments);
  });
