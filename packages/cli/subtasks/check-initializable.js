const { subtask } = require('hardhat/config');
const { SUBTASK_CHECK_INITIALIZATION } = require('../task-names');
const logger = require('@synthetixio/core-js/utils/io/logger');
const { capitalize } = require('@synthetixio/core-js/utils/misc/strings');

subtask(
  SUBTASK_CHECK_INITIALIZATION,
  'Check if current contract is initializable and if it is initialized'
).setAction(async (taskArguments, hre) => {
  const target = hre.deployer.deployment.general.contracts[hre.cli.contractName];
  const address = target.proxyAddress || target.deployedAddress;
  const abi = hre.deployer.deployment.abis[hre.cli.contractName];
  const abiFunctions = abi.filter((abiItem) => abiItem.name && abiItem.type === 'function');

  const capitalizedContractName = capitalize(hre.cli.contractName.split(':')[1]);
  const isInitializableFunctionName = `is${capitalizedContractName}Initialized`;
  const initializeFunctionName = `initialize${capitalizedContractName}`;

  const isInitializable = abiFunctions.some((f) => f.name === isInitializableFunctionName);

  if (isInitializable) {
    const contract = new hre.ethers.Contract(address, abi, hre.ethers.provider);
    const result = await contract[isInitializableFunctionName]();

    if (!result) {
      logger.warn(
        `Contract initializable but not initialized. Call ${initializeFunctionName}() with the right paramters first`
      );
    }
  }
});
