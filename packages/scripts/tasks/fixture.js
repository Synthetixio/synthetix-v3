const { randomInt } = require('crypto');
const { task } = require('hardhat/config');
const logger = require('@synthetixio/core-js/utils/io/logger');
const types = require('@synthetixio/core-js/utils/hardhat/argument-types');
const assertPeriod = require('../internal/assert-period');
const getPackageProxy = require('../internal/get-package-proxy');
const { COUNCILS } = require('../internal/constants');

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
  .addParam('council', 'Target council deployment', undefined, types.oneOf(...COUNCILS))
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
