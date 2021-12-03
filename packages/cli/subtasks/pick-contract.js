const { subtask } = require('hardhat/config');
const { SUBTASK_PICK_CONTRACT } = require('../task-names');
const inquirer = require('inquirer');

subtask(SUBTASK_PICK_CONTRACT, 'Pick contract to interact with').setAction(
  async (taskArguments, hre) => {
    const contractNames = Object.keys(hre.deployer.deployment.general.contracts);

    const { contractName } = await inquirer.prompt([
      {
        type: 'autocomplete',
        name: 'contractName',
        message: 'Pick a CONTRACT:',
        source: async (matches, query) => {
          return contractNames.filter((contractName) => {
            if (query) {
              return contractName.toLowerCase().includes(query.toLowerCase());
            }

            return contractName;
          });
        },
      },
    ]);

    hre.cli.contractName = contractName;
  }
);
