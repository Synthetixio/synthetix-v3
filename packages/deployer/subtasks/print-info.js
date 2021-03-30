const fs = require('fs');
const figlet = require('figlet');
const chalk = require('chalk');
const logger = require('../utils/logger');
const prompter = require('../utils/prompter');
const { subtask } = require('hardhat/config');
const { getCommit, getBranch } = require('../utils/git');
const { SUBTASK_PRINT_INFO } = require('../task-names');
const { readPackageJson } = require('../utils/package');

/*
 * Prints info about a deployment.
 * */
subtask(SUBTASK_PRINT_INFO).setAction(async (taskArguments) => {
  await _printTitle();

  await _printInfo(taskArguments);

  await prompter.confirmAction('Proceed with deployment');
});

async function _printTitle() {
  async function figPring(msg, font = 'Slant') {
    return new Promise((resolve) => {
      figlet.text(msg, { font }, function (err, formattedMsg) {
        if (err) {
          throw new Error(err);
        }

        console.log(chalk.red(formattedMsg));
        resolve();
      });
    });
  }

  await figPring(readPackageJson().name);
  await figPring('           deployer');
}

async function _printInfo(taskArguments) {
  logger.log(chalk.yellow('\nPlease confirm these deployment parameters:'));
  logger.boxStart();

  logger.log(chalk.gray(`commit: ${getCommit()}`));

  const branch = getBranch();
  logger.log(chalk[branch !== 'master' ? 'red' : 'gray'](`branch: ${branch}`));

  const network = hre.network.name;
  logger.log(chalk[network.includes('mainnet') ? 'red' : 'gray'](`network: ${network}`));

  logger.log(chalk.gray(`debug: ${taskArguments.debug}`));

  if (fs.existsSync(hre.deployer.file)) {
    logger.log(chalk.gray(`deployment file: ${hre.deployer.file}`));
  } else {
    logger.log(chalk.green(`new deployment file: ${hre.deployer.file}`));
  }

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
