const { subtask } = require('hardhat/config');
const { SUBTASK_EXECUTE_CALL } = require('../task-names');
const logger = require('@synthetixio/core-js/utils/logger');
const chalk = require('chalk');
const prompter = require('@synthetixio/core-js/utils/prompter');

subtask(SUBTASK_EXECUTE_CALL, 'Execute the current tx').setAction(async (taskArguments, hre) => {
  const abi = hre.deployer.deployment.abis[hre.cli.contractName];
  const functionAbi = abi.find((abiItem) => abiItem.name === hre.cli.functionName);

  const readOnly = functionAbi.stateMutability === 'view';

  if (readOnly) {
    await executeReadTransaction(abi);
  } else {
    await executeWriteTransaction(abi);
  }
});

async function executeReadTransaction(abi) {
  const contract = new hre.ethers.Contract(
    hre.deployer.deployment.general.contracts[hre.cli.contractName].deployedAddress,
    abi,
    hre.ethers.provider,
  );

  const result = await contract[hre.cli.functionName](...hre.cli.functionParameters);

  logger.checked(`Result: ${result}`);
}

async function executeWriteTransaction(abi) {
  const signer = (await hre.ethers.getSigners())[0];

  const contract = new hre.ethers.Contract(
    hre.deployer.deployment.general.contracts[hre.cli.contractName].deployedAddress,
    abi,
    signer,
  );

  let tx;
  try {
    const estimateGas = await contract.estimateGas[hre.cli.functionName](...hre.cli.functionParameters);
    hre.cli.callConfirmed = await prompter.ask(`Estimated gas: ${estimateGas}. Continue?`);

    tx = await contract[hre.cli.functionName](...hre.cli.functionParameters);
  } catch(error) {
    logger.error(`Transaction reverted during gas estimation with error "${error}"`);
  }

  if (tx) {
    logger.info(`Sending transaction with hash ${tx.hash}`);

    let receipt;
    try {
      receipt = await tx.wait();
    } catch(error) {
      logger.error(`Error sending transaction: ${error}\n${JSON.stringify(tx, null, 2)}`);
    }

    if (receipt) {
      logger.checked(`Transaction mined with gas ${receipt.gasUsed}`);

      if (receipt.status === 0) {
        logger.error(`Transaction reverted:\n${JSON.stringify(receipt, null, 2)}`);
      } else {
        logger.success(`Transaction succeeded`);
      }

      printEventsInReceipt(receipt);
    }
  }
}

function printEventsInReceipt(receipt) {
  const numEvents = receipt.events.length;

  if (numEvents > 0) {
    logger.info(`(${numEvents}) events emitted:`);

    receipt.events.map((event) => {
      logger.log(chalk.gray(`- ${event.event}(${event.args.join(', ')})`));
    });
  }
}
