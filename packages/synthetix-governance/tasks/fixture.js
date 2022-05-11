const { task } = require('hardhat/config');
const types = require('@synthetixio/core-js/utils/hardhat/argument-types');

const ElectionPeriod = {
  Administration: 0,
  Nomination: 1,
  Vote: 2,
  Evaluation: 3,
};

/**
 * Example:
 *  npx hardhat --network local fixture:candidates --address 0x...
 */
task('fixture:candidates', 'create fixture wallets and nominate them')
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

    console.log(`Fixturing ${amount} candidates for ${address}\n`);

    const candidates = createArray(amount).map(() => hre.ethers.Wallet.createRandom());

    let i = 0;
    await Promise.all(
      candidates.map(async (candidate) => {
        const signer = new hre.ethers.Wallet(candidate.privateKey, hre.ethers.provider);

        await hre.network.provider.request({
          method: 'hardhat_setBalance',
          params: [signer.address, '0x10000000000000000000000'],
        });

        const tx = await ElectionModule.connect(signer).nominate();
        await tx.wait();

        console.log(`Candidate #${++i}: `, candidate.address);
        console.log('Private Key: ', candidate.privateKey);
        console.log();
      })
    );
  });

function createArray(length) {
  return Array.from(Array(Number(length)));
}
