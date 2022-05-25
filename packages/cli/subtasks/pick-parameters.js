const { subtask } = require('hardhat/config');
const { SUBTASK_PICK_PARAMETERS } = require('../task-names');
const prompts = require('prompts');
const logger = require('@synthetixio/core-js/utils/io/logger');

subtask(SUBTASK_PICK_PARAMETERS, 'Populate the selected function parameters').setAction(
  async (taskArguments, hre) => {
    hre.cli.functionParameters = [];

    const functionAbi = hre.cli.functionAbi;

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
          hre.cli.functionParameters.push(await _parseInput(answer, parameter.type, hre));

          parameterIndex++;
        } catch (error) {
          logger.warn(error);
        }
      } else {
        // Cancelling returns to pick-function
        hre.cli.functionAbi = null;
        hre.cli.functionParameters = null;
        parameterIndex = functionAbi.inputs.length;
      }
    }
  }
);

async function _parseInput(input, type, hre) {
  if (type.includes('[]')) {
    input = JSON.parse(input);
  }

  const processed = await _preprocessInput(input, type, hre);
  if (input !== processed) {
    logger.info(`"${input}" auto-converted to "${processed}"`);

    input = processed;
  }

  // Encode and decode the user's input to parse it
  // into types acceptable by ethers.
  const abiCoder = hre.ethers.utils.defaultAbiCoder;
  input = abiCoder.encode([type], [input]);
  input = abiCoder.decode([type], input)[0];

  return input;
}

async function _preprocessInput(input, type, hre) {
  const isNumber = !isNaN(input);
  const isHex = hre.ethers.utils.isHexString(input);

  // E.g. "sUSD" to "0x7355534400000000000000000000000000000000000000000000000000000000"
  if (type === 'bytes32' && !isNumber && !isHex) {
    return hre.ethers.utils.formatBytes32String(input);
  }

  // E.g. "self" or "signer" to signer address
  if ((type === 'address' && input === 'self') || input === 'signer') {
    return (await hre.ethers.getSigners())[0].address;
  }

  return input;
}
