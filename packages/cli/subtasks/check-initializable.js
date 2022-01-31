const { subtask } = require('hardhat/config');
const { parseFullyQualifiedName } = require('hardhat/utils/contract-names');
const { capitalize } = require('@synthetixio/core-js/utils/misc/strings');
const logger = require('@synthetixio/core-js/utils/io/logger');
const { SUBTASK_CHECK_INITIALIZATION } = require('../task-names');

subtask(
  SUBTASK_CHECK_INITIALIZATION,
  'Check if current contract is initializable and if it is initialized'
).setAction(async (taskArguments, hre) => {
  const address = hre.cli.contractDeployedAddress;
  const abi = hre.deployer.deployment.abis[hre.cli.contractFullyQualifiedName];
  const abiFunctions = abi.filter((abiItem) => abiItem.name && abiItem.type === 'function');

  const { contractName } = parseFullyQualifiedName(hre.cli.contractFullyQualifiedName);
  const capitalizedContractName = capitalize(contractName);
  const isInitializedFunctionName = `is${capitalizedContractName}Initialized`;
  const initializeFunctionName = `initialize${capitalizedContractName}`;

  const isInitializable = abiFunctions.some((f) => f.name === isInitializedFunctionName);

  if (isInitializable) {
    const contract = new hre.ethers.Contract(address, abi, hre.ethers.provider);
    const result = await contract[isInitializedFunctionName]();

    if (!result) {
      logger.warn(
        `Contract initializable but not initialized. Call ${initializeFunctionName}() with the right paramters first`
      );
    }
  }
});
