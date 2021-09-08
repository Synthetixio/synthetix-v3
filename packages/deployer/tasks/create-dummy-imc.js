const path = require('path');
const { task } = require('hardhat/config');

const {
  SUBTASK_GENERATE_IMC_SOURCE,
  SUBTASK_SYNC_SOURCES,
  TASK_DUMMY_IMC,
} = require('../task-names');
const logger = require('../utils/logger');
const prompter = require('../utils/prompter');

task(TASK_DUMMY_IMC, 'Deploys all system modules')
  .addFlag('noConfirm', 'Skip all confirmation prompts', false)
  .addFlag('debug', 'Display debug logs', false)
  .setAction(async (taskArguments, hre) => {
    const { debug, noConfirm } = taskArguments;

    logger.debugging = debug;
    prompter.noConfirm = noConfirm;

    const { paths } = hre.deployer;

    paths.deployments = path.resolve(hre.config.paths.root, hre.config.deployer.paths.deployments);
    paths.modules = path.resolve(hre.config.paths.root, hre.config.deployer.paths.modules);

    // IMC Mixin
    hre.deployer.imcMixinModule = 'GenIMCMixin';
    paths.mixins = path.resolve(hre.config.paths.root, hre.config.deployer.paths.mixins);
    paths.imcMixinTemplate = path.resolve(__dirname, '../templates/GenIMCMixin.sol.mustache');
    paths.imcMixinPath = path.join(paths.mixins, `${hre.deployer.imcMixinModule}.sol`);

    hre.deployer.data = { contracts: { modules: {} } };
    await hre.run(SUBTASK_SYNC_SOURCES);
    await hre.run(SUBTASK_GENERATE_IMC_SOURCE, { dummyImc: true });
  });
