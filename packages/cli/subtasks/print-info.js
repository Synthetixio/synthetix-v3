const chalk = require('chalk');
const logger = require('@synthetixio/core-js/utils/logger');
const { subtask } = require('hardhat/config');
const { SUBTASK_PRINT_INFO } = require('../task-names');
const { readPackageJson } = require('@synthetixio/core-js/utils/npm');
const { getCommit, getBranch } = require('@synthetixio/core-js/utils/git');
const relativePath = require('@synthetixio/core-js/utils/relative-path');

subtask(SUBTASK_PRINT_INFO, 'Prints info about the interaction with a particular system').setAction(
  async (taskArguments) => {
    await _printTitle();
    await _printInfo(taskArguments);
  }
);

async function _printTitle() {
  await logger.title(`${readPackageJson().name}\n          CLI`);
}

async function _printInfo(taskArguments) {
  logger.log(chalk.yellow('\nPlease confirm these interaction parameters:'));
  logger.boxStart();

  logger.log(chalk.gray(`commit: ${getCommit()}`));

  const branch = getBranch();
  logger.log(chalk[branch !== 'master' ? 'red' : 'gray'](`branch: ${branch}`));

  const network = hre.network.name;
  logger.log(chalk[network.includes('mainnet') ? 'red' : 'gray'](`network: ${network}`));

  logger.log(chalk.gray(`instance: ${taskArguments.instance}`));
  logger.log(chalk.gray(`deployment: ${relativePath(hre.deployer.paths.deployment)}`));

  const signer = (await hre.ethers.getSigners())[0];
  const balance = hre.ethers.utils.formatEther(
    await hre.ethers.provider.getBalance(signer.address)
  );
  logger.log(chalk.gray(`signer: ${signer.address}`));
  logger.log(chalk.gray(`signer balance: ${balance} ETH`));

  logger.boxEnd();
}
