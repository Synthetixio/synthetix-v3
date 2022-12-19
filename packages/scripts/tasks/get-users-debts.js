const { task } = require('hardhat/config');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const snx = require('synthetix');
const ethers = require('ethers');
const createQueue = require('fastq');
const sortKeys = require('sort-keys');
const logger = require('@synthetixio/core-js/utils/io/logger');
const types = require('@synthetixio/core-js/utils/hardhat/argument-types');
const relativePath = require('@synthetixio/core-js/utils/misc/relative-path');

const { SynthetixDebtShare } = snx.getSource();

task(
  'governance:get-users-debts',
  'Get all the addresses with their debts querying to the SynthetixDebtShare contract'
)
  .addOptionalParam('providerUrl', 'RPC Provider url to use.')
  .addOptionalParam(
    'address',
    'SynthetixDebtShare contract address',
    snx.getTarget({ network: 'mainnet', contract: 'SynthetixDebtShare' }).address,
    types.address
  )
  .addOptionalParam(
    'fromBlock',
    'Block number from where to start getting users debts',
    '14169250',
    types.int
  )
  .addOptionalParam(
    'untilBlock',
    'Block until which to fetch data. Defaults to latest emitted FeePeriodClosed event blockNumber.'
  )
  .setAction(async ({ address, fromBlock, untilBlock, providerUrl }, hre) => {
    const provider = providerUrl
      ? new hre.ethers.providers.JsonRpcProvider(providerUrl)
      : hre.ethers.provider;

    if (!untilBlock) {
      untilBlock = await hre.run('governance:get-fee-period-close');
    }

    const filename = path.resolve(__dirname, '..', 'data', `${untilBlock}-users-debts.json`);

    logger.subtitle('Users Debts');
    logger.boxStart();
    logger.log(chalk.gray(`      Provider URL: ${hre.network.config.url}`));
    logger.log(chalk.gray(`  Deployed Address: ${address}`));
    logger.log(chalk.gray(`        From Block: ${fromBlock}`));
    logger.log(chalk.gray(`       Until block: ${untilBlock}`));
    logger.log(chalk.gray(`              File: ${relativePath(filename)}`));
    logger.boxEnd();

    const Contract = new hre.ethers.Contract(address, SynthetixDebtShare.abi, provider);

    await downloadDebts({
      Contract,
      fromBlock: Number(fromBlock),
      untilBlock: Number(untilBlock),
      filename,
    });
  });

async function downloadDebts({ Contract, fromBlock, untilBlock, filename }) {
  logger.log('  Fetching users debts...');

  let addresses = await getAccounts(Contract, fromBlock, untilBlock);

  logger.log(`  Collected ${addresses.length} addresses`);

  // Do not get debts for addresses already fetched
  if (fs.existsSync(filename)) {
    const data = read(filename).debts;

    if (
      data.contractAddress !== Contract.address ||
      data.fromBlock !== fromBlock ||
      data.untilBlock !== untilBlock
    ) {
      throw new Error('Invalid debts file');
    }

    const currentAddresses = new Set(addresses);
    for (const address of Object.keys(data.debts)) {
      currentAddresses.delete(address);
    }
    addresses = Array.from(currentAddresses);
  } else {
    fs.writeFileSync(
      filename,
      JSON.stringify(
        {
          contractAddress: Contract.address,
          fromBlock,
          untilBlock,
          debts: {},
        },
        null,
        2
      )
    );
  }

  await getDebts({ filename, Contract, untilBlock, addresses });
}

async function getAccounts(Contract, fromBlock, toBlock) {
  logger.subtitle('Looking for all the addresses that interacted with Synthetix');

  // Use a Set to have implicitily unique values
  const addresses = new Set();

  // Alchemy limits the amount of blocks we can fetch per request, so, we batch them.
  const batchSize = 50000;
  const batchCount = Math.ceil((toBlock - fromBlock) / batchSize);

  const queue = createQueue.promise(async function (i) {
    const from = fromBlock + batchSize * i;
    const to = from + batchSize - 1 > toBlock ? toBlock : from + batchSize - 1;

    logger.info(`Fetching blocks from ${from} to ${to} (${i + 1}/${batchCount})`);

    const filter = Contract.filters.Transfer(null, null, null);
    const events = await Contract.queryFilter(filter, from, to);

    for (const event of events) {
      addresses.add(event.args.to);
      addresses.add(event.args.from);
    }
  }, 5);

  for (let i = 0; i < batchCount; i++) {
    queue.push(i);
  }

  await queue.drained();

  addresses.delete('0x0000000000000000000000000000000000000000');

  return Array.from(addresses);
}

async function getDebts({ filename, addresses, Contract, untilBlock }) {
  const debts = {};

  let i = 0;
  const pad = addresses.length.toString().length;

  const queue = createQueue.promise(async function (address) {
    try {
      const debt = await Contract.balanceOf(address, { blockTag: untilBlock });

      if (debt > 0) {
        writeDebt(filename, address, debt.toString());
      }

      const index = (++i).toString().padStart(pad);
      logger.info(`${index} ${address} debt: ${ethers.utils.formatEther(debt)}`);
    } catch (err) {
      logger.error(`Error processing ${address}:`);
      logger.error(err);
    }
  }, 5);

  for (const address of addresses) {
    queue.push(address);
  }

  await queue.drained();

  return debts;
}

function read(filename) {
  return JSON.parse(fs.readFileSync(filename));
}

function writeDebt(filename, key, value) {
  const data = read(filename);
  data.debts[key] = value;
  fs.writeFileSync(filename, JSON.stringify(sortKeys(data), null, 2));
}
