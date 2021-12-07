const { subtask } = require('hardhat/config');
const { SUBTASK_PICK_FUNCTION } = require('../task-names');
const prompts = require('prompts');
const { getSignatureWithParameterNamesAndValues } = require('../internal/signatures');

subtask(SUBTASK_PICK_FUNCTION, 'Pick a function from the given contract').setAction(
  async (taskArguments, hre) => {
    const abi = hre.deployer.deployment.abis[hre.cli.contractName];
    const abiFunctions = abi.filter((abiItem) => abiItem.name && abiItem.type === 'function');

    const choices = abiFunctions.map((abiItem) => {
      return {
        title: getSignatureWithParameterNamesAndValues(hre.cli.contractName, abiItem.name),
        value: abiItem.name,
      };
    });

    const { functionName } = await prompts([
      {
        type: 'autocomplete',
        name: 'functionName',
        message: 'Pick a FUNCTION:',
        choices,
      },
    ]);

    if (functionName) {
      hre.cli.functionName = functionName;
    } else {
      // Cancelling returns to pick-contract
      hre.cli.contractName = null;
    }
  }
);
