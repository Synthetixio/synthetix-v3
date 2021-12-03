const { subtask } = require('hardhat/config');
const constants = require('../constants');
const { SUBTASK_PICK_PARAMETER } = require('../task-names');
const inquirer = require('inquirer');

subtask(SUBTASK_PICK_PARAMETER, 'Populate a single function parameter').setAction(
  async (taskArguments, hre) => {
    const abi = hre.deployer.deployment.abis[hre.cli.contractName];
    const functionAbi = abi.find((abiItem) => abiItem.name === hre.cli.functionName);

    console.log(JSON.stringify(functionAbi, null, 2));

    for (let input of functionAbi.inputs) {
      hre.run(SUBTASK_PICK_PARAMETER, taskArguments);
    }

    // abiFunctions.splice(0, 0, { name: constants.BACK });

    // const { functionName } = await inquirer.prompt([
    //   {
    //     type: 'autocomplete',
    //     name: 'functionName',
    //     message: 'Pick a FUNCTION:',
    //     source: async (matches, query) => {
    //       return abiFunctions.filter((abiItem) => {
    //         if (query) {
    //           return abiItem.name.toLowerCase().includes(query.toLowerCase());
    //         }

    //         return abiItem.name;
    //       });
    //     },
    //   },
    // ]);

    // hre.cli.functionName = functionName !== constants.BACK ? functionName : null;
  }
);
