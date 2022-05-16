const { task } = require('hardhat/config');
const types = require('@synthetixio/core-js/utils/hardhat/argument-types');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');

const {
  TASK_FAST_FORWARD_TO,
  TASK_FIXTURE_WALLETS,
  TASK_FIXTURE_CANDIDATES,
  TASK_FIXTURE_VOTES,
  TASK_FIXTURE_EPOCHS,
  TASK_FIXTURE_EVALUATE,
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
  .addOptionalParam('nominateAmount', 'Amount of candidates to fixture', '12', types.int)
  .addOptionalParam('withdrawAmount', 'Amount of candidates to withdraw nomination', '2', types.int)
  .setAction(async ({ address, nominateAmount, withdrawAmount }, hre) => {
    const ElectionModule = await hre.ethers.getContractAt(
      'contracts/modules/ElectionModule.sol:ElectionModule',
      address
    );

    const currentPeriod = Number(await ElectionModule.getCurrentPeriod());

    if (currentPeriod !== ElectionPeriod.Nomination) {
      throw new Error('The election is not on ElectionPeriod.Nomination');
    }

    const candidates = await hre.run(TASK_FIXTURE_WALLETS, { nominateAmount });

    console.log(`Nominating ${nominateAmount} candidates on ${address}\n`);

    await Promise.all(
      candidates.map(async (candidate) => {
        const tx = await ElectionModule.connect(candidate).nominate();
        await tx.wait();
      })
    );

    const withdrawnCandidates = candidates.splice(0, withdrawAmount);

    console.log(`Withdrawing ${withdrawAmount.length} candidates on ${address}\n`);

    await Promise.all(
      withdrawnCandidates.map(async (candidate) => {
        console.log(candidate.address);
        const tx = await ElectionModule.connect(candidate).withdrawNomination();
        await tx.wait();
      })
    );

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

    const currentPeriod = Number(await ElectionModule.getCurrentPeriod());

    if (currentPeriod !== ElectionPeriod.Vote) {
      throw new Error('The election is not on ElectionPeriod.Vote');
    }

    console.log(`Fixturing ${amount} voters on ${address}\n`);

    const voters = await hre.run(TASK_FIXTURE_WALLETS, { amount });
    const candidates = await ElectionModule.getNominees();

    const ballotsCount = Math.floor(candidates.length / Number(ballotSize));

    console.log(`Fixturing ${ballotsCount} ballots from ${candidates.length} candidates\n`);

    const ballots = createArray(ballotsCount).map(() => pickRand(candidates, ballotSize));

    // @MATI - can you add a case where some of the voters withdraw - and log it somehow to console? i did the withdraw nomination already
    await Promise.all(
      voters.map(async (voter) => {
        const [ballot] = pickRand(ballots, 1);
        const tx = await ElectionModule.connect(voter).cast(ballot);
        await tx.wait();
      })
    );

    await Promise.all(
      ballots.map(async (ballot) => {
        const ballotId = await ElectionModule.calculateBallotId(ballot);
        const votes = await ElectionModule.getBallotVotes(ballotId);
        console.log('BallotId: ', ballotId);
        console.log('Candidates:');
        ballot.forEach((address, i) => {
          console.log(` #${i}: `, address);
        });
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

    const currentPeriod = Number(await ElectionModule.getCurrentPeriod());

    if (currentPeriod !== ElectionPeriod.Evaluation) {
      throw new Error('The election is not on ElectionPeriod.Evaluation');
    }

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
    console.log(`There is ${members.length} Members whom are ${members.map((e) => `${e}\n`)}\n`);
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

    for (let i = 0; i < amount; i++) {
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

function pickRand(arr, amount = 1) {
  if (!Array.isArray(arr) || arr.length < amount) throw new Error('Invalid data');

  const res = [];
  while (res.length < amount) {
    const item = arr[rand(0, arr.length - 1)];
    if (!res.includes(item)) res.push(item);
  }

  return res;
}

function rand(min = 1, max = 10) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function createArray(length) {
  return Array.from(Array(Number(length)));
}
