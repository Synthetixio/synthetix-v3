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
        const councilChoices = [];

        councilChoices.push(
          new inquirer.Separator(
            `${council.name.toLocaleUpperCase().replace('-', ' ')} (Period: ${
              council.currentPeriod
            })`
          )
        );

        if (council.currentPeriod === 'Evaluation') {
          councilChoices.push({
            name: '  Evaluate election',
            value: {
              type: 'run',
              name: 'evaluate-election',
              args: { instance, council: council.name },
            },
          });
        } else if (council.currentPeriod === 'Nomination') {
          councilChoices.push({
            name: '  Nominate 14 fixture candidates',
            value: {
              type: 'run',
              name: 'fixture:candidates',
              args: { instance, council: council.name, nominateAmount: '14' },
            },
          });
        }

        if (council.currentPeriod !== 'Evaluation') {
          const nextPeriod = getNext(Object.keys(ElectionPeriod), council.currentPeriod);
          const nextPeriodDate = await getPeriodDate(council.Proxy, nextPeriod);
          councilChoices.push({
            name: `  Forward to next period "${nextPeriod}" (timestamp: ${nextPeriodDate})`,
            value: {
              type: 'run',
              name: 'fast-forward-to',
              args: { instance, council: council.name, period: nextPeriod },
            },
          });
        }

        choices.push(...councilChoices);
      });

      const { response } = await inquirer.prompt({
        type: 'list',
        name: 'response',
        message: 'What action do you want to perform?',
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
      logger.info(`Address #${i}: ${wallet.address}`);
      logger.info(`Private Key: ${wallet.privateKey}`);
      logger.log('');
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

    logger.log(`Nominating ${nominateAmount} candidates on "${council}"\n`);

    const candidates = await hre.run('fixture:wallets', { amount: nominateAmount });

    for (const [i, candidate] of candidates.entries()) {
      logger.info(`Address #${i}: ${candidate.address}`);
      const tx = await Proxy.connect(candidate).nominate();
      await tx.wait();
    }

    const withdrawnCandidates = pickRand(candidates, Number(withdrawAmount));

    logger.log(`Withdrawing ${withdrawAmount} candidates on "${council}"`);

    for (const [i, candidate] of withdrawnCandidates.entries()) {
      logger.info(`Address #${i}: ${candidate.address}`);
      const tx = await Proxy.connect(candidate).withdrawNomination();
      await tx.wait();
    }

    logger.log('');

    return candidates;
  });

task('fixture:votes', 'Create fixture votes to nominated candidates')
  .addOptionalParam('instance', 'Deployment instance name', 'official', types.alphanumeric)
  .addParam(
    'council',
    'From which council to take the period time',
    undefined,
    types.oneOf(...COUNCILS)
  )
  .addOptionalParam('amount', 'Amount of voters to fixture', '20', types.int)
  .addOptionalParam('ballotSize', 'Amount of cadidates for each ballot', '1', types.int)
  .setAction(async ({ instance, council, amount, ballotSize }, hre) => {
    const Proxy = await getPackageProxy(hre, council, instance);

    await assertPeriod(Proxy, 'Vote');

    logger.log(`Fixturing ${amount} voters on "${council}"\n`);

    const voters = await hre.run('fixture:wallets', { amount });
    const candidates = await Proxy.getNominees();

    const ballotsCount = Math.floor(candidates.length / Number(ballotSize));

    logger.log(`Fixturing ${ballotsCount} ballots from ${candidates.length} candidates\n`);

    const ballots = createArray(ballotsCount).map(() => pickRand(candidates, ballotSize));

    logger.log('');
    logger.log('Casting votes');

    for (const voter of voters) {
      const ballot = ballots[randomInt(ballots.length)];
      const ballotId = await Proxy.calculateBallotId(ballot);
      const votePower = await Proxy.getVotePower(voter.address);
      const tx = await Proxy.connect(voter).cast(ballot);
      await tx.wait();
      logger.info(`  Voter: ${voter.address} | BallotId: ${ballotId} | VotePower: ${votePower}`);
    }

    // Withdraw a random amount of votes between 1/3 and 0
    const votesToWithdraw = pickRand(voters, randomInt(0, Math.ceil(Number(amount) / 3) + 1));
    logger.log('');
    logger.log(`Withdrawing ${votesToWithdraw.length} votes`);

    for (const voter of votesToWithdraw) {
      const votePower = await Proxy.getVotePower(voter.address);
      const tx = await Proxy.connect(voter).withdrawVote();
      await tx.wait();
      logger.info(`  Voter: ${voter.address} | VotePower: ${votePower}`);
    }

    logger.log('');
    logger.log('Voting Results:');

    for (const ballot of ballots) {
      const ballotId = await Proxy.calculateBallotId(ballot);
      const votes = await Proxy.getBallotVotes(ballotId);
      logger.log('BallotId: ', ballotId);
      logger.log('Candidates:');
      ballot.forEach((address, i) => logger.info(` #${i}: `, address));
      logger.log('Vote Count: ', votes.toString());
      logger.log('');
    }
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
  return await Promise.all(arr.map(fn));
}
