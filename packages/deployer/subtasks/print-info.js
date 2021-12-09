const chalk = require('chalk');
const { subtask } = require('hardhat/config');

const logger = require('@synthetixio/core-js/utils/logger');
const prompter = require('@synthetixio/core-js/utils/prompter');
const relativePath = require('@synthetixio/core-js/utils/relative-path');
const { getCommit, getBranch } = require('@synthetixio/core-js/utils/git');
const { SUBTASK_PRINT_INFO } = require('../task-names');

subtask(SUBTASK_PRINT_INFO, 'Prints info about a deployment.').setAction(async (taskArguments) => {
  await _printInfo(taskArguments);

  await prompter.confirmAction('Proceed with deployment');
});

async function _printInfo(taskArguments) {
  logger.log(chalk.yellow('\nPlease confirm these deployment parameters:'));
  logger.boxStart();

  logger.log(chalk.gray(`commit: ${getCommit()}`));

  const branch = getBranch();
  logger.log(chalk[branch !== 'master' ? 'red' : 'gray'](`branch: ${branch}`));

  const network = hre.network.name;
  logger.log(chalk[network.includes('mainnet') ? 'red' : 'gray'](`network: ${network}`));

  logger.log(chalk.gray(`instance: ${taskArguments.instance}`));
  logger.log(chalk.gray(`debug: ${taskArguments.debug}`));
  logger.log(chalk.gray(`deployment: ${relativePath(hre.deployer.paths.deployment)}`));

  const signer = (await hre.ethers.getSigners())[0];
  const balance = hre.ethers.utils.formatEther(
    await hre.ethers.provider.getBalance(signer.address)
  );
  logger.log(chalk.gray(`signer: ${signer.address}`));
  logger.log(chalk.gray(`signer balance: ${balance} ETH`));

  if (taskArguments.clear) {
    logger.log(chalk.red('clear: true'));
  }

  logger.boxEnd();

  logger.debug('Deployer configuration:');
  logger.debug(JSON.stringify(hre.config.deployer, null, 2));
}
