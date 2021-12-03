const { subtask } = require('hardhat/config');
const { SUBTASK_PICK_PARAMETERS } = require('../task-names');
const inquirer = require('inquirer');
const logger = require('@synthetixio/core-js/utils/logger');

subtask(SUBTASK_PICK_PARAMETERS, 'Populate the selected function\'s parameters').setAction(
  async (taskArguments, hre) => {
    hre.cli.functionParameters = [];

    const abi = hre.deployer.deployment.abis[hre.cli.contractName];
    const functionAbi = abi.find((abiItem) => abiItem.name === hre.cli.functionName);

    const abiCoder = hre.ethers.utils.defaultAbiCoder;

    let parameterIndex = 0;
    while (parameterIndex < functionAbi.inputs.length) {
      const parameter = functionAbi.inputs[parameterIndex];

      const { userInput } = await inquirer.prompt([
        {
          type: 'input',
          name: 'userInput',
          message: `  ${parameter.name} (${parameter.type}):`,
        },
      ]);

      let encodedParameter;
      try {
        // Encode and decode to parse user input.
        encodedParameter = abiCoder.encode([parameter.type], [userInput]);
        encodedParameter = abiCoder.decode([parameter.type], encodedParameter);

        hre.cli.functionParameters.push(encodedParameter);

        parameterIndex++;
      } catch (error) {
        logger.warn(error);
      }
    }
  }
);
