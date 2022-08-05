const { subtask } = require('hardhat/config');
const { SUBTASK_PICK_FUNCTION, SUBTASK_CHECK_INITIALIZATION } = require('../task-names');
const chalk = require('chalk');
const autocomplete = require('../internal/autocomplete');
const { getFullFunctionSignature } = require('../internal/signatures');
const { getSelectors } = require('@synthetixio/core-js/utils/ethers/contracts');

subtask(SUBTASK_PICK_FUNCTION, 'Pick a function from the given contract').setAction(
  async (taskArguments, hre) => {
    const abi = hre.deployer.deployment.abis[hre.cli.contractFullyQualifiedName];
    const abiFunctions = abi.filter((abiItem) => abiItem.name && abiItem.type === 'function');
    const selectors = await getSelectors(abi, hre.config.deployer.routerFunctionFilter);

    const choices = abiFunctions.map((functionAbi) => {
      const fullSignature = getFullFunctionSignature(functionAbi);
      const selector = selectors.find((selector) => selector.name === functionAbi.name).selector;

      return {
        title: `${fullSignature}${chalk.gray(` ${selector}`)}`,
        value: functionAbi,
      };
    });

    await hre.run(SUBTASK_CHECK_INITIALIZATION);

    const functionAbi = await autocomplete({
      message: 'Pick a FUNCTION:',
      choices,
    });

    if (functionAbi) {
      hre.cli.functionAbi = functionAbi;
    } else {
      // Cancelling returns to pick-contract
      hre.cli.contractFullyQualifiedName = null;
    }
  }
);
