const { subtask } = require('hardhat/config');
const { SUBTASK_PREVIEW_CALL } = require('../task-names');
const logger = require('@synthetixio/core-js/utils/logger');
const prompter = require('@synthetixio/core-js/utils/prompter');
const { getSignatureWithParameterNamesAndValues } = require('../internal/signatures');

subtask(SUBTASK_PREVIEW_CALL, 'Preview the call to make').setAction(async (taskArguments, hre) => {
  const abi = hre.deployer.deployment.abis[hre.cli.contractName];
  const functionAbi = abi.find((abiItem) => abiItem.name === hre.cli.functionName);

  logger.info(
    `Calling ${hre.cli.contractName}.${getSignatureWithParameterNamesAndValues(
      hre.cli.contractName,
      hre.cli.functionName,
      hre.cli.functionParameters
    )}`
  );

  const readOnly = functionAbi.stateMutability === 'view';
  if (!readOnly) {
    logger.warn('This is a write transaction');

    const signer = (await hre.ethers.getSigners())[0];
    logger.info(`Signer to use: ${signer.address}`);

    hre.cli.callConfirmed = await prompter.ask('Do you confirm sending this transaction?');
  } else {
    hre.cli.callConfirmed = true;
  }
});
