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
	SUBTASK_SYNC_SOURCES,
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
	.setAction(async ({ force, logLevel, noConfirm }, hre) => {
		logger.logLevel = logLevel;
		prompter.noConfirm = noConfirm;

		_printInfo({ force, logLevel }, hre);

		// Confirm!
		await prompter.confirmAction('Proceed with deployment?');

		await hre.run(TASK_COMPILE, { force: true });
		await hre.run(SUBTASK_SYNC_SOURCES, {});
		await hre.run(SUBTASK_DEPLOY_MODULES, { force });
		await hre.run(SUBTASK_GENERATE_ROUTER_SOURCE, {});
	});

function _printInfo({ force, logLevel }, hre) {
	const package = readPackageJson({ hre });
	const network = hre.network.name;
	const branch = getBranch();
	const commit = getCommit();

	console.log(chalk.blue.bold(`Deploying ** ${package.name} **`));
	console.log(chalk.yellow('------------------------------------------------------------'));
	console.log(chalk.gray(`Commit: ${commit}`));
	console.log(chalk[branch !== 'master' ? 'red' : 'gray'](`Branch: ${branch}`));
	console.log(chalk[network.includes('mainnet') ? 'red' : 'gray'](`Network: ${network}`));
	console.log(chalk.gray(`Log level: ${logLevel}`));
	if (force)
		console.log(chalk.red('--force is true - This will override all existing deployments'));
	console.log(chalk.yellow('------------------------------------------------------------'));
}
