const { subtask } = require('hardhat/config');
const { SUBTASK_PICK_PARAMETERS } = require('../task-names');
const prompts = require('prompts');
const logger = require('@synthetixio/core-js/utils/logger');

subtask(SUBTASK_PICK_PARAMETERS, 'Populate the selected function parameters').setAction(
  async (taskArguments, hre) => {
    hre.cli.functionParameters = [];

    const abi = hre.deployer.deployment.abis[hre.cli.contractName];
    const functionAbi = abi.find((abiItem) => abiItem.name === hre.cli.functionName);

    const abiCoder = hre.ethers.utils.defaultAbiCoder;

    let parameterIndex = 0;
    // Using a while loop so that the user can retry failed inputs
    while (parameterIndex < functionAbi.inputs.length) {
      const parameter = functionAbi.inputs[parameterIndex];

      const { answer } = await prompts([
        {
          type: 'text',
          name: 'answer',
          message: `${parameter.name} (${parameter.type}):`,
        },
      ]);

      if (answer) {
        let encodedParameter;

        try {
          // Encode and decode the user's input to parse the input
          // into types acceptable by ethers.
          encodedParameter = abiCoder.encode([parameter.type], [answer]);
          encodedParameter = abiCoder.decode([parameter.type], encodedParameter);

          hre.cli.functionParameters.push(...encodedParameter);

          parameterIndex++;
        } catch (error) {
          logger.warn(error);
        }
      } else {
        // Cancelling returns to pick-function
        hre.cli.functionName = null;
        parameterIndex = functionAbi.inputs.length;
      }
    }
  }
);
