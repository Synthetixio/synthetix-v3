const { subtask } = require('hardhat/config');
const { SUBTASK_PICK_CONTRACT } = require('../task-names');
const inquirer = require('inquirer');
const chalk = require('chalk');

subtask(SUBTASK_PICK_CONTRACT, 'Pick contract to interact with').setAction(
  async (taskArguments, hre) => {
    const contractNames = Object.keys(hre.deployer.deployment.general.contracts);

    let { contractName } = await inquirer.prompt([
      {
        type: 'autocomplete',
        name: 'contractName',
        message: 'Pick a CONTRACT:',
        source: async (matches, query) => {
          return contractNames.filter((contractName) => {
            if (query) {
              return contractName.toLowerCase().includes(query.toLowerCase());
            }

            return true;
          }).map((contractName) => {
            const contractAddress = hre.deployer.deployment.general.contracts[contractName].deployedAddress;

            return `${contractName} ${chalk.gray(contractAddress)}`;
          });
        },
      },
    ]);

    // Remove address
    contractName = contractName.split(' ')[0];

    hre.cli.contractName = contractName;
  }
);
