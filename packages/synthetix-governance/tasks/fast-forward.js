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
  .addVariadicPositionalParam(
    'time',
    'the amount of time that you want to travel. Optionally you can add a unit of time (seconds|minutes|hours|days|weeks)'
  )
  .setAction(async ({ time }) => {
    const [amount, unit = 'seconds'] = time;

    if (!Object.keys(units).includes(unit)) {
      throw new Error(
        `Invalid unit of time "${unit}". Expected one of (seconds|minutes|hours|days|weeks)`
      );
    }

    await hre.ethers.provider.send('evm_mine');

    await fastForward(amount * units[unit], hre.ethers.provider);

    console.log(`Fast forwarded ${amount} ${unit}`);
  });
