const logger = require('../utils/logger');
const prompter = require('../utils/prompter');
const { getContractBytecodeHash } = require('../utils/contracts');
const { processTransaction, processReceipt } = require('../utils/transactions');
const { subtask } = require('hardhat/config');
const { SUBTASK_DEPLOY_CONTRACTS } = require('../task-names');
/*
 * Deploys a list of contracts, avoiding contracts that do not need to be compiled,
 * and prompting the user for confirmation.
 * */
subtask(SUBTASK_DEPLOY_CONTRACTS).setAction(
  async ({ contractNames, constructorArgs, areModules = false }) => {
    const deploymentsInfo = await _evaluateDeployments({ contractNames, areModules });
    await _confirmDeployments({ contractNames, deploymentsInfo });

    return await _deployContracts({ contractNames, constructorArgs, areModules, deploymentsInfo });
  }
);

async function _evaluateDeployments({ contractNames, areModules }) {
  const deploymentsInfo = {};

  let data = hre.deployer.data.contracts;
  data = areModules ? data.modules : data;

  for (let contractName of contractNames) {
    logger.debug(`${contractName}`);

    logger.debug(`network: ${hre.network.name}`);
    if (hre.network.name === 'hardhat') {
      deploymentsInfo[contractName] = 'always deploy in hardhat network';
      continue;
    }

    if (!data[contractName]) {
      data[contractName] = {};
    }
    const deployedData = data[contractName];

    logger.debug(`deployedData: ${JSON.stringify(deployedData, null, 2)}`);
    if (!deployedData.deployedAddress) {
      deploymentsInfo[contractName] = 'no previous deployment found';
      continue;
    }

    const sourceBytecodeHash = getContractBytecodeHash({
      contractName: contractName,
      isModule: areModules,
    });
    logger.debug(`source bytecodehash: ${sourceBytecodeHash}`);
    const storedBytecodeHash = deployedData.bytecodeHash;
    logger.debug(`stored bytecodeHash: ${sourceBytecodeHash}`);
    const bytecodeChanged = sourceBytecodeHash !== storedBytecodeHash;
    if (bytecodeChanged) {
      deploymentsInfo[contractName] = 'bytecode changed';
      continue;
    }
  }

  return deploymentsInfo;
}

async function _confirmDeployments({ contractNames, deploymentsInfo }) {
  for (let contractName of contractNames) {
    const reason = deploymentsInfo[contractName];

    if (reason) {
      logger.notice(`${contractName} needs deployment - reason: ${deploymentsInfo[contractName]}`);
    } else {
      logger.checked(`${contractName} does not need to be deployed`);
    }
  }

  const numDeployments = Object.keys(deploymentsInfo).length;
  if (numDeployments === 0) {
    return;
  }

  await prompter.confirmAction('Deploy these contracts');
}

async function _deployContracts({ contractNames, constructorArgs, deploymentsInfo, areModules }) {
  const deployed = [];

  for (let i = 0; i < contractNames.length; i++) {
    const contractName = contractNames[i];

    const reason = deploymentsInfo[contractName];
    if (!reason) {
      continue;
    }

    const args = constructorArgs ? constructorArgs[i] || [] : [];

    const factory = await hre.ethers.getContractFactory(contractName);
    const contract = await factory.deploy(...args);

    if (!contract.address) {
      throw new Error(`Error deploying ${contractName}`);
    }

    logger.success(`Deployed ${contractName} to ${contract.address}`);

    const transaction = contract.deployTransaction;
    processTransaction({ transaction });

    const receipt = await hre.ethers.provider.getTransactionReceipt(transaction.hash);
    processReceipt({ receipt, hre });

    let data = hre.deployer.data.contracts;
    data = areModules ? data.modules : data;

    data[contractName] = {
      deployedAddress: contract.address,
      deployTransaction: transaction.hash,
      bytecodeHash: getContractBytecodeHash({ contractName, isModule: areModules }),
    };

    deployed.push(contract);
  }

  return deployed;
}
