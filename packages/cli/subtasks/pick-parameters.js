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
    while (parameterIndex < functionAbi.inputs.length) {
      const parameter = functionAbi.inputs[parameterIndex];

      await prompts([
        {
          type: 'text',
          message: ` ${parameter.name} (${parameter.type}):`,
        },
      ], {
        onCancel: (prompt) => {
          hre.cli.functionName = null;
          parameterIndex = functionAbi.inputs.length;
        },
        onSubmit: (prompt, answer) => {
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
        },
      });

    }
  }
);
