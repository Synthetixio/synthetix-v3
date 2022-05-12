const { task } = require('hardhat/config');
const types = require('@synthetixio/core-js/utils/hardhat/argument-types');

const ElectionPeriod = {
  Administration: 0,
  Nomination: 1,
  Vote: 2,
  Evaluation: 3,
};

task('fixture:wallets', 'Create fixture wallets')
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

task('fixture:candidates', 'Create fixture candidate nominations')
  .addParam('address', 'Deployed election module proxy address', undefined, types.address)
  .addOptionalParam('amount', 'Amount of candidates to fixture', '50', types.int)
  .setAction(async ({ address, amount }, hre) => {
    const ElectionModule = await hre.ethers.getContractAt(
      'contracts/modules/ElectionModule.sol:ElectionModule',
      address
    );

    const currentPeriod = Number(await ElectionModule.getCurrentPeriod());

    if (currentPeriod !== ElectionPeriod.Nomination) {
      throw new Error('The election is not on ElectionPeriod.Nomination');
    }

    const candidates = await hre.run('fixture:wallets', { amount });

    console.log(`Nominating ${amount} candidates for ${address}\n`);

    await Promise.all(
      candidates.map(async (candidate) => {
        const tx = await ElectionModule.connect(candidate).nominate();
        await tx.wait();
      })
    );

    return candidates;
  });

task('fixture:votes', 'Create fixture votes to nominated candidates')
  .addParam('address', 'Deployed election module proxy address', undefined, types.address)
  .addOptionalParam('amount', 'Amount of voters to fixture', '30', types.int)
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

    console.log(`Fixturing ${amount} voters for ${address}\n`);

    const voters = await hre.run('fixture:wallets', { amount });
    const candidates = await ElectionModule.getNominees();

    const ballotsCount = Math.floor(candidates.length / Number(ballotSize));

    console.log(`Fixturing ${ballotsCount} ballots from ${candidates.length} candidates\n`);

    const ballots = createArray(ballotsCount).map(() => pickRand(candidates, ballotSize));

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

task('fixture:epochs', 'Create fixture votes to nominated candidates')
  .addParam('address', 'Deployed election module proxy address', undefined, types.address)
  .addOptionalParam('amount', 'Amount of epochs to complete with fixture data', '5', types.int)
  .addOptionalParam('ballotSize', 'Amount of cadidates for each ballot', '5', types.int);

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
