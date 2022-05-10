const { task } = require('hardhat/config');
const { fastForward } = require('@synthetixio/core-js/utils/hardhat/rpc');

const units = {
  seconds: 1,
  minutes: 60,
  hours: 60 * 60,
  days: 60 * 60 * 24,
  weeks: 60 * 60 * 24 * 7,
};

task('fast-forward', 'travel the given amount of time on the current node')
  .addPositionalParam(
    'amount',
    'The amount of time that you want to travel, by default in seconds.'
  )
  .addOptionalPositionalParam('unit', 'Unit of time (seconds|minutes|hours|days|weeks)', 'seconds')
  .setAction(async ({ amount, unit }) => {
    if (!Object.keys(units).includes(unit)) {
      throw new Error(
        `Invalid unit of time "${unit}". Expected one of (seconds|minutes|hours|days|weeks)`
      );
    }

    if (!/^[1-9][0-9]*$/.test(amount)) {
      throw new Error(`Invalid amount of time "${amount}". Expected an integer number`);
    }

    await hre.ethers.provider.send('evm_mine');

    await fastForward(Number(amount) * units[unit], hre.ethers.provider);

    console.log(`Fast forwarded ${amount} ${unit}`);
  });
