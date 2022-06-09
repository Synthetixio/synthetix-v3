const { randomInt } = require('crypto');
const { task } = require('hardhat/config');
const inquirer = require('inquirer');
const types = require('@synthetixio/core-js/utils/hardhat/argument-types');
const { formatDate } = require('@synthetixio/core-js/utils/misc/dates');
const logger = require('@synthetixio/core-js/utils/io/logger');
const getPackageProxy = require('../internal/get-package-proxy');
const getPeriodDate = require('../internal/get-period-date');
const getTimestamp = require('../internal/get-timestamp');
const assertPeriod = require('../internal/assert-period');
const { COUNCILS, ElectionPeriod } = require('../internal/constants');

task('governance-fixtures', 'CLI tools for managing governance fixtures')
  .addOptionalParam('instance', 'Deployment instance name', 'official', types.alphanumeric)
  .setAction(async ({ instance }, hre) => {
    //eslint-disable-next-line no-constant-condition
    while (true) {
      const councils = await initCouncils(hre, instance);

      const ui = new inquirer.ui.BottomBar();

      const timestamp = await getTimestamp(hre);
      const blockNumber = await hre.ethers.provider.getBlockNumber();

      const time = new Date(timestamp * 1000);
      ui.log.write(
        toOneLine({
          Network: hre.network.name,
          BlockNumber: blockNumber,
          Timestamp: timestamp,
          Date: formatDate(time),
        })
      );

      const choices = [];

      await asyncForEach(councils, async (council) => {
        choices.push(
          new inquirer.Separator(
            `${council.name.toLocaleUpperCase().replace('-', ' ')} (Period: ${
              council.currentPeriod
            })`
          )
        );

        if (council.currentPeriod === 'Evaluation') {
          choices.push({
            name: '  Evaluate election',
            value: {
              type: 'run',
              name: 'evaluate-election',
              args: { instance, council: council.name },
            },
          });
        } else if (council.currentPeriod === 'Nomination') {
          choices.push({
            name: '  Create 50 fixture nominee candidates',
            value: {
              type: 'run',
              name: 'fixture:candidates',
              args: { instance, council: council.name },
            },
          });
        }

        if (council.currentPeriod !== 'Evaluation') {
          const nextPeriod = getNext(Object.keys(ElectionPeriod), council.currentPeriod);
          const nextPeriodDate = await getPeriodDate(council.Proxy, nextPeriod);
          choices.push({
            name: `  Forward to next period "${nextPeriod}" (timestamp: ${nextPeriodDate})`,
            value: {
              type: 'run',
              name: 'fast-forward-to',
              args: { instance, council: council.name, period: nextPeriod },
            },
          });
        }
      });

      const { response } = await inquirer.prompt({
        type: 'list',
        name: 'response',
        message: 'What action do you want to perform?',
        pageSize: 10,
        choices,
      });

      if (response.type === 'run') {
        await hre.run(response.name, response.args);
        continue;
      }
    }
  });

task('fixture:wallets', 'Create fixture wallets')
  .addOptionalParam('amount', 'Amount of wallets to fixture', '50', types.int)
  .setAction(async ({ amount }, hre) => {
    logger.log(`Fixturing ${amount} wallets\n`);

    const wallets = createArray(amount).map(() => {
      const { privateKey } = hre.ethers.Wallet.createRandom();
      return new hre.ethers.Wallet(privateKey, hre.ethers.provider);
    });

    if (hre.network.config.url.startsWith('https://rpc.tenderly.co/')) {
      await hre.network.provider.request({
        method: 'tenderly_setBalance',
        params: [wallets.map((w) => w.address), '0x10000000000000000000000'],
      });
    } else if (['local', 'localhost', 'hardhat'].includes(hre.network.name)) {
      await asyncForEach(wallets, ({ address }) =>
        hre.network.provider.request({
          method: 'hardhat_setBalance',
          params: [address, '0x10000000000000000000000'],
        })
      );
    }

    for (const [i, wallet] of wallets.entries()) {
      logger.info(`Address #${i}: `, wallet.address);
      logger.info('Private Key: ', wallet.privateKey);
      logger.log();
    }

    return wallets;
  });

task('fixture:candidates', 'Create fixture candidate nominations')
  .addOptionalParam('instance', 'Deployment instance name', 'official', types.alphanumeric)
  .addParam(
    'council',
    'From which council to take the period time',
    undefined,
    types.oneOf(...COUNCILS)
  )
  .addOptionalParam('nominateAmount', 'Amount of candidates to fixture', '14', types.int)
  .addOptionalParam('withdrawAmount', 'Amount of candidates to withdraw nomination', '2', types.int)
  .setAction(async ({ instance, council, nominateAmount, withdrawAmount }, hre) => {
    const Proxy = await getPackageProxy(hre, council, instance);

    await assertPeriod(Proxy, 'Nomination');

    const candidates = await hre.run('fixture:wallets', { amount: nominateAmount });

    console.log(`Nominating ${candidates.length} candidates on "${council}"\n`);

    await asyncForEach(candidates, async (candidate) => {
      const tx = Proxy.connect(candidate).nominate();
      await tx.wait();
    });

    const withdrawnCandidates = pickRand(candidates, Number(withdrawAmount));

    logger.log(`Withdrawing ${withdrawAmount} candidates on "${council}"`);

    await asyncForEach(withdrawnCandidates, async (candidate) => {
      logger.info(candidate.address);
      const tx = await Proxy.connect(candidate).withdrawNomination();
      await tx.wait();
    });

    logger.log('');

    return candidates;
  });

async function initCouncils(hre, instance) {
  return await Promise.all(
    COUNCILS.map(async (name) => {
      const council = { name };
      council.Proxy = await getPackageProxy(hre, name, instance);
      council.currentPeriod = Object.keys(ElectionPeriod)[await council.Proxy.getCurrentPeriod()];
      return council;
    })
  );
}

function getNext(arr, curr) {
  if (!Array.isArray(arr)) throw new Error('Expected array value');
  const currIndex = arr.findIndex((val) => val === curr);
  if (currIndex === -1) throw new Error(`Item "${curr}" not found in "${JSON.stringify(arr)}"`);
  return arr[currIndex === arr.length - 1 ? 0 : currIndex + 1];
}

function toOneLine(obj = {}) {
  return Object.entries(obj)
    .map(([key, val]) => `${key}: ${val}`)
    .join(' | ');
}

function createArray(length = 0) {
  return Array.from(Array(Number(length)));
}

function pickRand(arr, amount = 1) {
  if (!Array.isArray(arr) || arr.length < amount) throw new Error('Invalid data');

  const src = [...arr];
  const res = [];
  while (res.length < amount) {
    res.push(...src.splice(randomInt(src.length), 1));
  }

  return res;
}

async function asyncForEach(arr, fn) {
  await Promise.all(arr.map(fn));
}
