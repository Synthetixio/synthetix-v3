const logger = require('../utils/logger');
const chalk = require('chalk');
const { readDeploymentFile, saveDeploymentFile } = require('../utils/deploymentFile');
const { getContractBytecodeHash } = require('../utils/getBytecodeHash');
const { subtask } = require('hardhat/config');
const { SUBTASK_DEPLOY_CONTRACT } = require('../task-names');

/*
 * Deploys a single contract.
 * */
subtask(SUBTASK_DEPLOY_CONTRACT).setAction(async ({ contractName, isModule }, hre) => {
  logger.log(chalk.green(`Deploying ${contractName}...`));

  const factory = await hre.ethers.getContractFactory(contractName);
  const contract = await factory.deploy();

  if (!contract.address) {
    throw new Error(`Error deploying ${contractName}`);
  }

  logger.log(chalk.green(`Deployed ${contractName} to ${contract.address}`), 1);

  const data = readDeploymentFile({ hre });
  const target = isModule ? data.modules : data;

  target[contractName] = {
    deployedAddress: contract.address,
    bytecodeHash: getContractBytecodeHash({ contractName, isModule, hre }),
  };

  saveDeploymentFile({ data, hre });

  return contract;
});
