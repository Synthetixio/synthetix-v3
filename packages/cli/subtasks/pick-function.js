const { subtask } = require('hardhat/config');
const { SUBTASK_PICK_FUNCTION } = require('../task-names');
const prompts = require('prompts');
const chalk = require('chalk');
const { getSignatureWithParameterNamesAndValues } = require('../internal/signatures');
const { getSelectors } = require('@synthetixio/core-js/utils/contracts');

subtask(SUBTASK_PICK_FUNCTION, 'Pick a function from the given contract').setAction(
  async (taskArguments, hre) => {
    const abi = hre.deployer.deployment.abis[hre.cli.contractName];
    const abiFunctions = abi.filter((abiItem) => abiItem.name && abiItem.type === 'function');
    const selectors = await getSelectors(abi);

    const choices = abiFunctions.map((abiItem) => {
      const fullSignature = getSignatureWithParameterNamesAndValues(hre.cli.contractName, abiItem.name);
      const selector = selectors.find((selector) => selector.name === abiItem.name).selector;

      return {
        title: `${chalk.gray(hre.cli.contractName)}.${fullSignature} ${chalk.gray(selector)}`,
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
