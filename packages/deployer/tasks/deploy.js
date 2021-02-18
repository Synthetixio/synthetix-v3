const chalk = require('chalk');
const logger = require('../utils/logger');
const prompter = require('../utils/prompter');
const { task, types } = require('hardhat/config');
const { TASK_COMPILE } = require('hardhat/builtin-tasks/task-names');
const { readPackageJson } = require('../utils/package');
const { getCommit, getBranch } = require('../utils/git');

const {
  TASK_DEPLOY,
  SUBTASK_DEPLOY_MODULES,
  SUBTASK_GENERATE_ROUTER_SOURCE,
} = require('../task-names');

task(
  TASK_DEPLOY,
  'Deploys all modules that changed, and generates and deploys a router for those modules'
)
  .addFlag('noConfirm', 'Skip all confirmations', false)
  .addFlag('force', 'Ignore all previously deployed contracts', false)
  .addOptionalParam(
    'logLevel',
    'Control stdout output level: 1 = minimal, 2 = descriptive, 3 = debug',
    1,
    types.int
  )
  .setAction(async (taskArguments, hre) => {
    await hre.run(TASK_COMPILE, taskArguments);

    logger.logLevel = taskArguments.logLevel;
    prompter.noConfirm = taskArguments.noConfirm;

    _printInfo({ taskArguments, hre });

    // Confirm!
    if (!prompter.noConfirm) {
      await prompter.confirmAction({
        message: 'Proceed with deployment?',
      });
    }

    await hre.run(SUBTASK_DEPLOY_MODULES, taskArguments);
    await hre.run(SUBTASK_GENERATE_ROUTER_SOURCE, taskArguments);
  });

function _printInfo({ taskArguments, hre }) {
  const package = readPackageJson({ hre });
  const network = hre.network.name;
  const branch = getBranch();
  const commit = getCommit();

  console.log(chalk.yellow('------------------------------------------------------------'));
  console.log(chalk.blue(`Deploying ${package.name}`));
  console.log(chalk.gray(`Commit: ${commit}`));
  console.log(chalk[branch !== 'master' ? 'red' : 'gray'](`Branch: ${branch}`));
  console.log(chalk[network.includes('mainnet') ? 'red' : 'gray'](`Network: ${network}`));
  console.log(chalk.gray(`Log level: ${taskArguments.logLevel}`));
  if (taskArguments.force)
    console.log(chalk.red('--force is true - This will override all existing deployments'));
  console.log(chalk.yellow('------------------------------------------------------------'));
}
