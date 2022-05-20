const path = require('path');
const fs = require('fs/promises');
const { randomInt } = require('crypto');
const { task } = require('hardhat/config');
const types = require('@synthetixio/core-js/utils/hardhat/argument-types');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');
const { parseBalanceMap } = require('@synthetixio/core-js/utils/merkle-tree/parse-balance-tree');

const {
  TASK_FAST_FORWARD_TO,
  TASK_FIXTURE_WALLETS,
  TASK_FIXTURE_CANDIDATES,
  TASK_FIXTURE_VOTES,
  TASK_FIXTURE_EPOCHS,
  TASK_FIXTURE_EVALUATE,
  TASK_FIXTURE_CROSS_CHAIN_DEBT,
  TASK_SET_CROSS_CHAIN_DEBT,
} = require('../task-names');

const ElectionPeriod = {
  Administration: 0,
  Nomination: 1,
  Vote: 2,
  Evaluation: 3,
};

task(TASK_FIXTURE_WALLETS, 'Create fixture wallets')
  .addOptionalParam('amount', 'Amount of wallets to fixture', '50', types.int)
  .setAction(async ({ amount }, hre) => {
    console.log(`Fixturing ${amount} wallets\n`);

    const wallets = createArray(amount).map(() => {
      const { privateKey } = hre.ethers.Wallet.createRandom();
      return new hre.ethers.Wallet(privateKey, hre.ethers.provider);
    });

    let i = 0;
    return await Promise.all(
      wallets.map(async (wallet) => {
        hre.network.provider.request({
          method: 'hardhat_setBalance',
          params: [wallet.address, '0x10000000000000000000000'],
        });

        console.log(`Address #${++i}: `, wallet.address);
        console.log('Private Key: ', wallet.privateKey);
        console.log();

        return wallet;
      })
    );
  });

task(TASK_FIXTURE_CANDIDATES, 'Create fixture candidate nominations')
  .addParam('address', 'Deployed election module proxy address', undefined, types.address)
  .addOptionalParam('nominateAmount', 'Amount of candidates to fixture', '14', types.int)
  .addOptionalParam('withdrawAmount', 'Amount of candidates to withdraw nomination', '2', types.int)
  .setAction(async ({ address, nominateAmount, withdrawAmount }, hre) => {
    const ElectionModule = await hre.ethers.getContractAt(
      'contracts/modules/ElectionModule.sol:ElectionModule',
      address
    );

    await assertPeriod(ElectionModule, 'Nomination');

    const candidates = await hre.run(TASK_FIXTURE_WALLETS, { amount: nominateAmount });

    console.log(`Nominating ${nominateAmount} candidates on ${address}\n`);

    await Promise.all(
      candidates.map(async (candidate) => {
        const tx = await ElectionModule.connect(candidate).nominate();
        await tx.wait();
      })
    );

    const withdrawnCandidates = pickRand(candidates, Number(withdrawAmount));

    console.log(`Withdrawing ${withdrawAmount} candidates on ${address}`);

    await Promise.all(
      withdrawnCandidates.map(async (candidate) => {
        console.log('  - ', candidate.address);
        const tx = await ElectionModule.connect(candidate).withdrawNomination();
        await tx.wait();
      })
    );

    console.log();

    return candidates;
  });

task(TASK_FIXTURE_VOTES, 'Create fixture votes to nominated candidates')
  .addParam('address', 'Deployed election module proxy address', undefined, types.address)
  .addOptionalParam('amount', 'Amount of voters to fixture', '20', types.int)
  .addOptionalParam('ballotSize', 'Amount of cadidates for each ballot', '5', types.int)
  .setAction(async ({ address, amount, ballotSize }, hre) => {
    const ElectionModule = await hre.ethers.getContractAt(
      'contracts/modules/ElectionModule.sol:ElectionModule',
      address
    );

    await assertPeriod(ElectionModule, 'Vote');

    console.log(`Fixturing ${amount} voters on ${address}\n`);

    const voters = await hre.run(TASK_FIXTURE_WALLETS, { amount });
    const candidates = await ElectionModule.getNominees();

    const ballotsCount = Math.floor(candidates.length / Number(ballotSize));

    console.log(`Fixturing ${ballotsCount} ballots from ${candidates.length} candidates\n`);

    const ballots = createArray(ballotsCount).map(() => pickRand(candidates, ballotSize));

    console.log();
    console.log('Votes Casted');

    await Promise.all(
      voters.map(async (voter) => {
        const ballot = ballots[randomInt(ballots.length)];
        const ballotId = await ElectionModule.calculateBallotId(ballot);
        const votePower = await ElectionModule.getVotePower(voter.address);
        const tx = await ElectionModule.connect(voter).cast(ballot);
        await tx.wait();
        console.log(`  Voter: ${voter.address} | BallotId: ${ballotId} | VotePower: ${votePower}`);
      })
    );

    // Withdraw a random amount of votes between 1/3 and 0
    const votesToWithdraw = pickRand(voters, randomInt(0, Math.ceil(Number(amount) / 3) + 1));
    console.log();
    console.log(`Withdrawing ${votesToWithdraw.length} votes `);

    await Promise.all(
      votesToWithdraw.map(async (voter) => {
        const votePower = await ElectionModule.getVotePower(voter.address);
        const tx = await ElectionModule.connect(voter).withdrawVote();
        await tx.wait();
        console.log(`  Voter: ${voter.address} | VotePower: ${votePower}`);
      })
    );

    console.log();
    console.log('Voting Results:');

    await Promise.all(
      ballots.map(async (ballot) => {
        const ballotId = await ElectionModule.calculateBallotId(ballot);
        const votes = await ElectionModule.getBallotVotes(ballotId);
        console.log('BallotId: ', ballotId);
        console.log('Candidates:');
        ballot.forEach((address, i) => console.log(` #${i}: `, address));
        console.log('Vote Count: ', votes.toString());
        console.log();
      })
    );
  });

task(TASK_FIXTURE_EVALUATE, 'Evaluate current election')
  .addParam('address', 'Deployed election module proxy address', undefined, types.address)
  .setAction(async ({ address }, hre) => {
    const ElectionModule = await hre.ethers.getContractAt(
      'contracts/modules/ElectionModule.sol:ElectionModule',
      address
    );

    await assertPeriod(ElectionModule, 'Evaluation');

    console.log('Evaluating current election\n');

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const tx = await ElectionModule.evaluate(0);
      const receipt = await tx.wait();

      const evaluatedEvent = findEvent({ receipt, eventName: 'ElectionEvaluated' });
      if (evaluatedEvent) {
        console.log('Election evaluated');
        console.log('  epochIndex: ', Number(evaluatedEvent.args.epochIndex));
        console.log('  totalBallots: ', Number(evaluatedEvent.args.totalBallots));
        console.log();
        break;
      }

      const batchEvent = findEvent({ receipt, eventName: 'ElectionBatchEvaluated' });
      if (batchEvent) {
        console.log(batchEvent);
        console.log('Election batch evaluated');
        console.log('  epochIndex: ', Number(evaluatedEvent.args.epochIndex));
        console.log('  evaluatedBallots: ', Number(evaluatedEvent.args.evaluatedBallots));
        console.log();
        continue;
      }

      throw new Error('Election evaluation did not finish correctly');
    }

    const tx = await ElectionModule.resolve();
    const receipt = await tx.wait();
    const epochStartedEvent = findEvent({ receipt, eventName: 'EpochStarted' });

    const members = await ElectionModule.getCouncilMembers();

    console.log(
      `Election resolved, started new epoch index ${epochStartedEvent.args.epochIndex}\n`
    );
    console.log(`Current council members (${members.length}):`);
    members.forEach((address) => console.log('  - ', address));
  });

task(TASK_FIXTURE_EPOCHS, 'Complete an epoch with fixtured data')
  .addParam('address', 'Deployed election module proxy address', undefined, types.address)
  .addOptionalParam('amount', 'Amount of epochs to complete with fixture data', '1', types.int)
  .addOptionalParam('voters', 'Amount of voters to fixture', '20', types.int)
  .addOptionalParam('candidates', 'Amount of voters to fixture', '12', types.int)
  .setAction(async ({ address, amount, voters, candidates }, hre) => {
    const ElectionModule = await hre.ethers.getContractAt(
      'contracts/modules/ElectionModule.sol:ElectionModule',
      address
    );

    for (let i = 0; i < Number(amount); i++) {
      let currentPeriod = Number(await ElectionModule.getCurrentPeriod());

      if (currentPeriod === ElectionPeriod.Administration) {
        await hre.run(TASK_FAST_FORWARD_TO, { address, period: 'nomination' });
        currentPeriod = ElectionPeriod.Nomination;
      }

      if (currentPeriod === ElectionPeriod.Nomination) {
        await hre.run(TASK_FIXTURE_CANDIDATES, { address, amount: candidates });
        await hre.run(TASK_FAST_FORWARD_TO, { address, period: 'vote' });
        currentPeriod = ElectionPeriod.Vote;
      }

      if (currentPeriod === ElectionPeriod.Vote) {
        await hre.run(TASK_FIXTURE_VOTES, { address, amount: voters });
        await hre.run(TASK_FAST_FORWARD_TO, { address, period: 'evaluation' });
        currentPeriod = ElectionPeriod.Evaluation;
      }

      if (currentPeriod === ElectionPeriod.Evaluation) {
        await hre.run(TASK_FIXTURE_EVALUATE, { address });
      }
    }
  });

task(TASK_FIXTURE_CROSS_CHAIN_DEBT, 'Generate and save cross chain debt merkle tree')
  .addParam('address', 'Deployed election module proxy address', undefined, types.address)
  .addOptionalParam(
    'wallet',
    'custom wallet to fixture debt to, aside from hardhat signers',
    undefined,
    types.address
  )
  .addOptionalParam('amount', 'amount of debt to generate', undefined, types.int)
  .addOptionalParam('blockNumber', 'block number from the origin chain', '1', types.int)
  .setAction(async ({ address, wallet, amount, blockNumber }, hre) => {
    const ElectionModule = await hre.ethers.getContractAt(
      'contracts/modules/ElectionModule.sol:ElectionModule',
      address
    );

    await assertPeriod(ElectionModule, 'Nomination');

    const signers = (await hre.ethers.getSigners()).map(({ address }) => address);

    // Generate random cross-chain debts for hardhat signers
    const debts = signers.reduce((debts, address) => {
      // random debt between 1 and 10_000_000
      debts[address] = randNumberString(randomInt(19, 26));
      return debts;
    }, {});

    // If passed, also add a custom debt for the given wallet
    if (wallet) {
      debts[wallet] = amount || randNumberString(randomInt(19, 26));
    }

    // Create MerkleTree for the given debts
    const tree = parseBalanceMap(debts);

    const file = path.resolve(__dirname, '..', 'data');
    const location = path.resolve(file, `${hre.network.name}-${blockNumber}.json`);

    console.log('Saving merkle tree:');
    console.log(`  ${location}`);

    await fs.mkdir(file, { recursive: true });
    await fs.writeFile(location, JSON.stringify(tree, null, 2));

    await hre.run(TASK_SET_CROSS_CHAIN_DEBT, { address, file, blockNumber });
  });

function pickRand(arr, amount = 1) {
  if (!Array.isArray(arr) || arr.length < amount) throw new Error('Invalid data');

  const src = [...arr];
  const res = [];
  while (res.length < amount) {
    res.push(...src.splice(randomInt(src.length), 1));
  }

  return res;
}

function createArray(length = 0) {
  return Array.from(Array(Number(length)));
}

function randNumberString(length = 32) {
  return [randomInt(1, 10), ...createArray(length - 1).map(() => randomInt(10))].join('');
}

/**
 * @param {Object} ElectionModule
 * @param {("Administration"|"Nomination"|"Vote"|"Evaluation")} period
 */
async function assertPeriod(ElectionModule, period) {
  if (typeof ElectionPeriod[period] !== 'number') {
    throw new Error(`Invalid given period ${period}`);
  }

  const currentPeriod = Number(await ElectionModule.getCurrentPeriod());

  if (currentPeriod !== ElectionPeriod[period]) {
    throw new Error(`The election is not on ElectionPeriod.${period}`);
  }
}
