const path = require('path');
const { task } = require('hardhat/config');
const { TASK_COMPILE } = require('hardhat/builtin-tasks/task-names');

const {
  SUBTASK_DEPLOY_MODULES,
  SUBTASK_DEPLOY_ROUTER,
  SUBTASK_GENERATE_ROUTER_SOURCE,
  SUBTASK_PREPARE_DEPLOYMENT,
  SUBTASK_PRINT_INFO,
  SUBTASK_SYNC_SOURCES,
  SUBTASK_VALIDATE_ROUTER,
  TASK_DEPLOY,
} = require('../task-names');
const logger = require('../utils/logger');
const prompter = require('../utils/prompter');
const relativePath = require('../utils/relative-path');
const { capitalize } = require('../utils/string');

const isWord = (str) => /^[\w\d]+$/.test(str);

task(TASK_DEPLOY, 'Deploys all system modules')
  .addFlag('noConfirm', 'Skip all confirmation prompts', false)
  .addFlag('debug', 'Display debug logs', false)
  .addFlag('clear', 'Clear all previous deployment data for the selected network', false)
  .addOptionalParam('alias', 'The alias name for the deployment')
  .addOptionalParam('instance', 'The name of the target instance for deployment', 'official')
  .setAction(async (taskArguments, hre) => {
    const { alias, instance, debug, noConfirm } = taskArguments;

    logger.debugging = debug;
    prompter.noConfirm = noConfirm;

    if (!isWord(instance)) {
      throw new Error(
        'Invalid --instance parameter value, it can only be a lowercase word with numbers'
      );
    }

    if (alias && !isWord(alias)) {
      throw new Error(
        'Invalid --alias parameter value, it can only be a lowercase word with numbers'
      );
    }

    hre.deployer.routerModule = ['GenRouter', hre.network.name, instance].map(capitalize).join('');

    const { paths } = hre.deployer;

    paths.deployments = path.resolve(hre.config.paths.root, hre.config.deployer.paths.deployments);
    paths.modules = path.resolve(hre.config.paths.root, hre.config.deployer.paths.modules);
    paths.network = path.join(paths.deployments, hre.network.name);
    paths.instance = path.join(paths.network, instance);
    paths.extended = path.join(paths.instance, 'extended');
    paths.routerTemplate = path.resolve(__dirname, '../templates/GenRouter.sol.mustache');
    paths.routerPath = relativePath(
      path.join(hre.config.paths.sources, `${hre.deployer.routerModule}.sol`)
    );

    await hre.run(SUBTASK_PREPARE_DEPLOYMENT, taskArguments);
    await hre.run(SUBTASK_PRINT_INFO, taskArguments);
    await hre.run(TASK_COMPILE, { force: true, quiet: true });
    await hre.run(SUBTASK_SYNC_SOURCES);
    await hre.run(SUBTASK_DEPLOY_MODULES);
    await hre.run(SUBTASK_GENERATE_ROUTER_SOURCE);
    await hre.run(SUBTASK_VALIDATE_ROUTER);
    await hre.run(SUBTASK_DEPLOY_ROUTER);
  });
