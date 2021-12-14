const logger = require('@synthetixio/core-js/utils/io/prompter');
const prompter = require('@synthetixio/core-js/utils/prompter');
const { isAlreadyDeployed } = require('../internal/contract-helper');
const { processTransaction } = require('../internal/process-transactions');
const { subtask } = require('hardhat/config');
const { SUBTASK_DEPLOY_CONTRACT } = require('../task-names');
const { getCommit } = require('@synthetixio/core-js/utils/misc/git');

subtask(
  SUBTASK_DEPLOY_CONTRACT,
  'Deploys the given contract and update the contractData object.'
).setAction(async ({ contractName, constructorArgs = [], requireConfirmation = true }) => {
  const contractData = hre.deployer.deployment.general.contracts[contractName];

  if (!contractData) {
    throw new Error(`Cotract ${contractName} cannot be deployed because is not initialized.`);
  }

  if (await isAlreadyDeployed(contractName, contractData)) {
    return false;
  }

  if (requireConfirmation) {
    const confirmed = await prompter.ask(`Are you sure you want to deploy ${contractName}?`);

    if (!confirmed) {
      return false;
    }
  }

  // Create contract & start the transaction on the network
  const { contract, transaction } = await _createAndDeployContract(contractName, constructorArgs);

  contractData.deployedAddress = contract.address;
  contractData.deployTransaction = transaction.hash;
  contractData.deploymentBlock = await hre.ethers.provider.getBlockNumber();
  contractData.deploymentCommit = getCommit();

  return true;
});

/**
 * Deploy the given contract using ethers.js
 */
async function _createAndDeployContract(contractName, constructorArgs = []) {
  logger.success(`Deploying ${contractName}`);

  const factory = await hre.ethers.getContractFactory(contractName);
  const contract = await factory.deploy(...constructorArgs);

  if (!contract.address) {
    throw new Error(`Error deploying ${contractName}`);
  }

  const transaction = contract.deployTransaction;
  await processTransaction({ transaction, hre, description: `Deployment of ${contractName}` });

  return { contract, transaction };
}
