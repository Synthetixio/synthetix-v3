const { task } = require('hardhat/config');
const { fastForwardTo } = require('@synthetixio/core-js/utils/hardhat/rpc');
const types = require('@synthetixio/core-js/utils/hardhat/argument-types');

const periods = {
  nomination: async (ElectionModule) => {
    return (await ElectionModule.getNominationPeriodStartDate()).toNumber() + 1;
  },
  vote: async (ElectionModule) => {
    return (await ElectionModule.getVotingPeriodStartDate()).toNumber() + 1;
  },
  evaluation: async (ElectionModule) => {
    return (await ElectionModule.getEpochEndDate()).toNumber() + 1;
  },
};

task('fast-forward-to', 'skips time to the specified election period')
  .addParam(
    'address',
    'Deployed election module proxy address to get period date from',
    undefined,
    types.address
  )
  .addPositionalParam(
    'period',
    `Future period you want to fast forward to in time, should be one of ${Object.keys(
      periods
    ).join(', ')}`,
    undefined,
    types.oneOf(...Object.keys(periods))
  )
  .setAction(async ({ address, period }) => {
    const ElectionModule = await hre.ethers.getContractAt(
      'contracts/modules/ElectionModule.sol:ElectionModule',
      address
    );

    // necessary on first run, if not the next fastForwardTo() call does not work.
    await hre.ethers.provider.send('evm_mine');

    const time = await periods[period](ElectionModule);

    await fastForwardTo(time, hre.ethers.provider);

    console.log(`Fast forwarded to ${period} period (${time})`);
  });
