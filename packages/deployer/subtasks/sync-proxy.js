const { subtask } = require('hardhat/config');
const { getFullyQualifiedName, isFullyQualifiedName } = require('hardhat/utils/contract-names');
const logger = require('@synthetixio/core-js/utils/io/logger');
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

    const contractName = hre.config.deployer.proxyContract;
    const { sourceName } = await hre.artifacts.readArtifact(contractName);
    const proxyFullyQualifiedName = getFullyQualifiedName(sourceName, contractName);

    await initContractData(proxyFullyQualifiedName, { isProxy: true });

    const proxyData = Object.values(hre.deployer.deployment.general.contracts).find(
      (data) => data.isProxy
    );
    const previousProxyData = Object.values(
      hre.deployer.previousDeployment?.general.contracts || {}
    ).find((data) => data.isProxy);

    const currentBytecode = proxyData.deployedBytecodeHash;
    const previousBytecode = previousProxyData?.deployedBytecodeHash;

    if (hre.deployer.previousDeployment && !previousBytecode) {
      throw new ContractValidationError(
        'Proxy contract cannot be deleted or have its name changed'
      );
    }

    if (previousBytecode && previousBytecode !== currentBytecode) {
      throw new ContractValidationError(
        `The ${contractName} contract cannot be changed after first deployment`
      );
    }

    logger.checked('Proxy deployment data is in sync with sources');
  }
);
