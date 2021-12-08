const { subtask } = require('hardhat/config');
const { SUBTASK_PICK_PARAMETERS } = require('../task-names');
const prompts = require('prompts');
const logger = require('@synthetixio/core-js/utils/logger');

subtask(SUBTASK_PICK_PARAMETERS, 'Populate the selected function parameters').setAction(
  async (taskArguments, hre) => {
    hre.cli.functionParameters = [];

    const abi = hre.deployer.deployment.abis[hre.cli.contractName];
    const functionAbi = abi.find((abiItem) => abiItem.name === hre.cli.functionName);

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
        try {
          hre.cli.functionParameters.push(_parseInput(answer, parameter.type, hre));

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

function _parseInput(input, type, hre) {
  const processed = _preprocessInput(input, type, hre);
  if (input !== processed) {
    logger.info(`"${input}" auto-converted to "${processed}"`);

    input = processed;
  }

  // Encode and decode the user's input to parse the input
  // into types acceptable by ethers.
  const abiCoder = hre.ethers.utils.defaultAbiCoder;
  input = abiCoder.encode([type], [input]);
  input = abiCoder.decode([type], input)[0];

  return input;
}

function _preprocessInput(input, type, hre) {
  // E.g. "sUSD" to "0x7355534400000000000000000000000000000000000000000000000000000000"
  if (type === 'bytes32' && !hre.ethers.utils.isHexString(input)) {
    return hre.ethers.utils.formatBytes32String(input);
  }

  return input;
}
