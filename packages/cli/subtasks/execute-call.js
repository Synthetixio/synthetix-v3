const { subtask } = require('hardhat/config');
const { SUBTASK_EXECUTE_CALL } = require('../task-names');
const logger = require('@synthetixio/core-js/utils/io/logger');
const chalk = require('chalk');
const prompter = require('@synthetixio/core-js/utils/io/prompter');
const {
  getFullFunctionSignature,
  getFullEventSignature,
  getFunctionSignature,
} = require('../internal/signatures');

subtask(SUBTASK_EXECUTE_CALL, 'Execute the current tx').setAction(async (taskArguments, hre) => {
  const address = hre.cli.contractDeployedAddress;
  const abi = hre.deployer.deployment.abis[hre.cli.contractFullyQualifiedName];

  const functionAbi = hre.cli.functionAbi;
  const functionSignature = getFunctionSignature(functionAbi);
  console.log(functionSignature);

  logger.notice(
    `Calling ${hre.cli.contractFullyQualifiedName}.${getFullFunctionSignature(
      functionAbi,
      hre.cli.functionParameters
    )}`
  );
  logger.info(`Target: ${address}`);

  const contract = new hre.ethers.Contract(address, abi, hre.ethers.provider);
  const tx = await contract.populateTransaction[functionSignature](...hre.cli.functionParameters);
  logger.info(`Calldata: ${tx.data}`);

  const readOnly = functionAbi.stateMutability === 'view' || functionAbi.stateMutability === 'pure';
  if (readOnly) {
    await executeReadTransaction(functionSignature, contract);
  } else {
    await executeWriteTransaction(functionSignature, contract);
  }

  hre.cli.functionParameters = null;
  hre.cli.functionAbi = null;
});

async function executeReadTransaction(functionSignature, contract) {
  const result = await contract[functionSignature](...hre.cli.functionParameters);

  console.log(chalk.green(`✓ ${result}`));
}

async function executeWriteTransaction(functionSignature, contract) {
  const signer = (await hre.ethers.getSigners())[0];
  logger.info(`Signer: ${signer.address}`);
  logger.warn('This is a write transaction!');

  contract = contract.connect(signer);

  let tx;
  try {
    const estimateGas = await contract.estimateGas[functionSignature](
      ...hre.cli.functionParameters
    );
    const confirmed = await prompter.ask(`Estimated gas: ${estimateGas}. Continue?`);
    if (!confirmed) {
      return;
    }

    tx = await contract[functionSignature](...hre.cli.functionParameters);
  } catch (error) {
    logger.error(`Transaction reverted during gas estimation with error "${error}"`);
  }

  if (tx) {
    logger.info(`Sending transaction with hash ${tx.hash}`);
    logger.debug(JSON.stringify(tx, null, 2));

    let receipt;
    try {
      receipt = await tx.wait();
    } catch (error) {
      logger.error(`Error sending transaction: ${error}\n${JSON.stringify(tx, null, 2)}`);
    }

    if (receipt) {
      logger.checked(`Transaction mined with gas ${receipt.gasUsed}`);

      if (receipt.status === 0) {
        logger.error(`Transaction reverted:\n${JSON.stringify(receipt, null, 2)}`);
      } else {
        logger.success('Transaction succeeded');
      }

      logger.debug(JSON.stringify(receipt, null, 2));

      _printEventsInReceipt(receipt);
    }
  }
}

function _printEventsInReceipt(receipt) {
  const numEvents = receipt.events.length;

  if (numEvents > 0) {
    logger.info(`(${numEvents}) events emitted:`);

    receipt.events.forEach((event) => {
      if (event.event) {
        const abi = hre.deployer.deployment.abis[hre.cli.contractFullyQualifiedName];
        const eventAbi = abi.find((abiItem) => abiItem.name === event.event);

        console.log(chalk.green(`✓ ${getFullEventSignature(eventAbi, event)}`));
      } else {
        logger.log(
          chalk.gray(`* Unknown event with topics: [${event.topics}] and data: [${event.data}]`)
        );
      }

      logger.debug(JSON.stringify(event, null, 2));
    });
  }
}
