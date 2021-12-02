const { subtask } = require('hardhat/config');
const constants = require('../constants');
const { SUBTASK_PICK_FUNCTION } = require('../task-names');
const inquirer = require('inquirer');

subtask(SUBTASK_PICK_FUNCTION, 'Pick a function from the given contract').setAction(
  async (taskArguments, hre) => {
    const abi = hre.deployer.deployment.abis[hre.cli.contractName];
    const abiFunctions = abi.filter((abiItem) => abiItem.name && abiItem.type === 'function');

    abiFunctions.splice(0, 0, { name: constants.BACK });

    const { functionName } = await inquirer.prompt([
      {
        type: 'autocomplete',
        name: 'functionName',
        message: 'Pick a FUNCTION:',
        source: async (matches, query) => {
          return abiFunctions.filter((abiItem) => {
            if (query) {
              return abiItem.name.toLowerCase().includes(query.toLowerCase());
            }

            return abiItem.name;
          });
        },
      },
    ]);

    hre.cli.functionName = functionName !== constants.BACK ? functionName : null;
  }
);
