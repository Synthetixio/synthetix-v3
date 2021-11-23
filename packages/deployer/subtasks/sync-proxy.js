const { subtask } = require('hardhat/config');
const logger = require('@synthetixio/core-js/utils/logger');
const { initContractData } = require('../internal/process-contracts');
const { ContractValidationError } = require('../internal/errors');
const { SUBTASK_SYNC_PROXY } = require('../task-names');

/**
 * Compiles the Proxy's source, saves it to the deployments file, and checks
 * that it does not have changes if it's already deployed.
 */
subtask(SUBTASK_SYNC_PROXY, 'Compile and sync the source from the Proxy.').setAction(
  async (_, hre) => {
    logger.subtitle('Syncing and compiling source from the Proxy');

    const proxyName = hre.config.deployer.proxyContract;

    await initContractData(proxyName);

    const currentBytecode =
      hre.deployer.deployment.general.contracts[proxyName].deployedBytecodeHash;
    const previousBytecode =
      hre.deployer.previousDeployment?.general.contracts[proxyName]?.deployedBytecodeHash;

    if (hre.deployer.previousDeployment && !previousBytecode) {
      throw new ContractValidationError(
        'Proxy contract cannot be deleted or have its name changed'
      );
    }

    if (previousBytecode && previousBytecode !== currentBytecode) {
      throw new ContractValidationError(
        `The ${proxyName} contract cannot be changed after first deployment`
      );
    }

    logger.checked('Proxy deployment data is in sync with sources');
  }
);
