const { randomInt } = require('crypto');
const { task } = require('hardhat/config');
const logger = require('@synthetixio/core-js/utils/io/logger');
const types = require('@synthetixio/core-js/utils/hardhat/argument-types');
const { parseBalanceMap } = require('@synthetixio/core-js/utils/merkle-tree/parse-balance-tree');
const assertPeriod = require('../internal/assert-period');
const getPackageProxy = require('../internal/get-package-proxy');
const getPeriodDate = require('../internal/get-period-date');
const { periods } = require('../internal/get-period-date');
const { COUNCILS, ElectionPeriod } = require('../internal/constants');

task('fixture:wallets', 'Create fixture wallets')
  .addOptionalParam('amount', 'Amount of wallets to fixture', '20', types.int)
  .setAction(async ({ amount }, hre) => {
    logger.log(`Fixturing ${amount} wallets\n`);

    const wallets = createArray(amount).map(() => {
      const { privateKey } = hre.ethers.Wallet.createRandom();
      return new hre.ethers.Wallet(privateKey, hre.ethers.provider);
    });

    if (hre.network.config.url.startsWith('https://rpc.tenderly.co/fork/')) {
      await hre.network.provider.request({
        method: 'tenderly_setBalance',
        params: [wallets.map((w) => w.address), '0x10000000000000000000000'],
      });
    } else if (['local', 'localhost', 'hardhat'].includes(hre.network.name)) {
      for (const { address } of wallets) {
        await hre.network.provider.request({
          method: 'hardhat_setBalance',
          params: [address, '0x10000000000000000000000'],
        });
      }
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
  .addParam('council', 'Target council deployment', undefined, types.oneOf(...COUNCILS))
  .addOptionalParam('nominateAmount', 'Amount of candidates to fixture', '6', types.int)
  .addOptionalParam('withdrawAmount', 'Amount of candidates to withdraw nomination', '1', types.int)
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
  .addParam('council', 'Target council deployment', undefined, types.oneOf(...COUNCILS))
  .addOptionalParam('amount', 'Amount of voters to fixture', '10', types.int)
  .addOptionalParam('ballotSize', 'Amount of cadidates for each ballot', '1', types.int)
  .setAction(async ({ instance, council, amount, ballotSize }, hre) => {
    const Proxy = await getPackageProxy(hre, council, instance);

    await assertPeriod(Proxy, 'Vote');

    logger.log(`Fixturing ${amount} voters on "${council}"\n`);

    const voters = hre.fixture?.voters || (await hre.run('fixture:wallets', { amount }));

    if (hre.fixture?.voters) {
      for (const voter of hre.fixture.voters) {
        if (!hre.fixture.tree.claims[voter.address]) continue;

        const { amount, proof } = hre.fixture.tree.claims[voter.address];

        logger.log('Declaring cross chain debt');
        logger.log(` - Address: ${voter.address}`);
        logger.log(` - Amount: ${hre.ethers.BigNumber.from(amount).toString()}`);
        logger.log(` - Proof: ${JSON.stringify(proof)}`);
        await Proxy.declareCrossChainDebtShare(
          voter.address,
          hre.ethers.BigNumber.from(amount).toString(),
          proof
        );

        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

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
      logger.info(`  Voter: ${voter.address} | BallotId: ${ballotId} | VotePower: ${votePower}`);
      const tx = await Proxy.connect(voter).cast(ballot);
      await tx.wait();
      await new Promise((resolve) => setTimeout(resolve, 2000));
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
      logger.log(`BallotId: ${ballotId}`);
      logger.log('Candidates:');
      ballot.forEach((address, i) => logger.info(` #${i}: ${address}`));
      logger.log(`Vote Count: ${votes.toString()}`);
      logger.log('');
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  });

function generateMerkleTree(wallets) {
  const debts = wallets.reduce((debts, { address }) => {
    // random debt between 1 and 10_000_000
    debts[address] = randNumberString(randomInt(19, 23));
    return debts;
  }, {});

  // Create MerkleTree for the given debts
  const tree = parseBalanceMap(debts);

  return tree;
}

task('fixture:cross-chain-debt-tree', 'Generate cross chain debt merkle tree')
  .addOptionalParam('instance', 'Deployment instance name', 'official', types.alphanumeric)
  .addParam('council', 'Target council deployment', undefined, types.oneOf(...COUNCILS))
  .addOptionalParam('blockNumber', 'block number from the origin chain', '1', types.int)
  .setAction(async ({ instance, council, blockNumber }, hre) => {
    const Proxy = await getPackageProxy(hre, council, instance);

    await assertPeriod(Proxy, 'Nomination');

    const tree = hre.fixture.tree;

    logger.log('Setting Cross Chain Debt Root:');
    logger.info(`merkeRoot: ${tree.merkleRoot}`);
    logger.info(`blockNumber: ${blockNumber}`);

    const tx = await Proxy.setCrossChainDebtShareMerkleRoot(tree.merkleRoot, Number(blockNumber));
    await tx.wait();

    logger.success(`Done (tx: ${tx.hash})`);

    logger.info('');
  });

task('fixture:epoch', 'Fixture a complete epoch')
  .addOptionalParam('instance', 'Deployment instance name', 'official', types.alphanumeric)
  .addOptionalParam(
    'until',
    `Until which period to fixture, should be one of ${periods.join(', ')}`,
    'Evaluation',
    types.enum
  )
  .setAction(async ({ instance, period }, hre) => {
    hre.fixture = {};

    const until = ElectionPeriod[period];
    const Proxies = await Promise.all(
      COUNCILS.map((councilName) => getPackageProxy(hre, councilName, instance))
    );

    const runOnCouncils = async (taskName, args = {}) => {
      for (const council of COUNCILS) {
        await hre.run(taskName, { ...args, instance, council });
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    };

    let currentPeriod = await getCommonCurrentPeriod(Proxies);

    if (currentPeriod === ElectionPeriod.Administration) {
      await fastForwardToPeriod(Proxies, 'Nomination');

      currentPeriod = await getCommonCurrentPeriod(Proxies);
      if (until === ElectionPeriod.Administration) return;
    }

    hre.fixture.voters = await hre.run('fixture:wallets', { amount: '5' });
    hre.fixture.tree = generateMerkleTree(hre.fixture.voters);

    if (currentPeriod === ElectionPeriod.Nomination) {
      await runOnCouncils('governance:set-debt-share-snapshot-id');
      await runOnCouncils('fixture:cross-chain-debt-tree');
      await runOnCouncils('fixture:candidates');
      await fastForwardToPeriod(Proxies, 'Vote');

      currentPeriod = await getCommonCurrentPeriod(Proxies);
      if (until === ElectionPeriod.Nomination) return;
    }

    if (currentPeriod === ElectionPeriod.Vote) {
      await runOnCouncils('fixture:votes');

      await fastForwardToPeriod(Proxies, 'Evaluation');
      currentPeriod = await getCommonCurrentPeriod(Proxies);
      if (until === ElectionPeriod.Vote) return;
    }

    if (currentPeriod === ElectionPeriod.Evaluation) {
      await runOnCouncils('governance:evaluate-election');
      if (until === ElectionPeriod.Evaluation) return;
    }
  });

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

function randNumberString(length = 32) {
  return [randomInt(1, 10), ...createArray(length - 1).map(() => randomInt(10))].join('');
}

async function asyncMap(arr, fn) {
  return await Promise.all(arr.map(fn));
}

async function getCommonCurrentPeriod(Proxies) {
  const currentPeriodIds = await asyncMap(Proxies, async (Proxy) =>
    Number(await Proxy.getCurrentPeriod())
  );

  if (new Set(currentPeriodIds).size !== 1) {
    throw new Error('All councils are not in the same period');
  }

  return Number(currentPeriodIds[0]);
}

async function fastForwardToPeriod(Proxies, periodName) {
  logger.log(`Fast forwarding to "${periodName}" period`);
  const timestamps = await asyncMap(Proxies, (Proxy) => getPeriodDate(Proxy, periodName));
  const time = timestamps.reduce((prev, curr) => (curr > prev ? curr : prev), 0);
  await hre.run('fast-forward-to', { time: `${time}` });
}
