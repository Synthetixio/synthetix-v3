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

    await prompts(
      [
        {
          type: 'autocomplete',
          message: 'Pick a FUNCTION:',
          choices,
        },
      ],
      {
        onCancel: () => {
          hre.cli.functionName = null;
          hre.cli.contractName = null;
        },
        onSubmit: (prompt, answer) => {
          hre.cli.functionName = answer;
        },
      }
    );
  }
);
