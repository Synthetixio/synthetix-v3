const { subtask } = require('hardhat/config');
const { SUBTASK_PREVIEW_CALL } = require('../task-names');
const logger = require('@synthetixio/core-js/utils/logger');
const { getSignatureWithParameterNamesAndValues } = require('../internal/signatures');

subtask(SUBTASK_PREVIEW_CALL, 'Preview the call to make').setAction(async (taskArguments, hre) => {
  logger.info(
    `Calling ${hre.cli.contractName}.${getSignatureWithParameterNamesAndValues(
      hre.cli.contractName,
      hre.cli.functionName,
      hre.cli.functionParameters
    )}`
  );
});
