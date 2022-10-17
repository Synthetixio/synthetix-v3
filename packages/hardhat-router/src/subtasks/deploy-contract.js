const { default: logger } = require('@synthetixio/core-utils/utils/io/logger');
const { default: prompter } = require('@synthetixio/core-utils/utils/io/prompter');
const { isAlreadyDeployed } = require('../internal/contract-helper');
const { processTransaction } = require('../internal/process-transactions');
const { subtask } = require('hardhat/config');
const { SUBTASK_DEPLOY_CONTRACT } = require('../task-names');
const { getCommit } = require('@synthetixio/core-utils/utils/misc/git');

subtask(
  SUBTASK_DEPLOY_CONTRACT,
  'Deploys the given contract and update the contractData object.'
).setAction(
  async ({ contractFullyQualifiedName, constructorArgs = [], requireConfirmation = true }) => {
    const contractData = hre.router.deployment.general.contracts[contractFullyQualifiedName];

    if (!contractData) {
      throw new Error(
        `Cotract ${contractFullyQualifiedName} cannot be deployed because is not initialized.`
      );
    }

    if (await isAlreadyDeployed(contractData)) {
      return false;
    }

    if (requireConfirmation) {
      const confirmed = await prompter.ask(
        `Are you sure you want to deploy ${contractFullyQualifiedName}?`
      );

      if (!confirmed) {
        return false;
      }
    }

    // Create contract & start the transaction on the network
    const { contract, transaction } = await _createAndDeployContract(
      contractFullyQualifiedName,
      constructorArgs
    );

    contractData.deployedAddress = contract.address;
    contractData.deployTransaction = transaction.hash;
    contractData.deploymentBlock = await hre.ethers.provider.getBlockNumber();
    contractData.deploymentCommit = getCommit();

    return true;
  }
);

/**
 * Deploy the given contract using ethers.js
 */
async function _createAndDeployContract(contractFullyQualifiedName, constructorArgs = []) {
  logger.success(`Deploying ${contractFullyQualifiedName}`);

  const factory = await hre.ethers.getContractFactory(contractFullyQualifiedName);
  const contract = await factory.deploy(...constructorArgs);

  if (!contract.address) {
    throw new Error(`Error deploying ${contractFullyQualifiedName}`);
  }

  const transaction = contract.deployTransaction;
  await processTransaction({
    transaction,
    hre,
    description: `Deployment of ${contractFullyQualifiedName}`,
  });

  return { contract, transaction };
}
