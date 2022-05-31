const { task } = require('hardhat/config');
const types = require('@synthetixio/core-js/utils/hardhat/argument-types');
const { fastForward } = require('@synthetixio/core-js/utils/hardhat/rpc');
const { TASK_FAST_FORWARD } = require('../task-names');

const units = {
  seconds: 1,
  minutes: 60,
  hours: 60 * 60,
  days: 60 * 60 * 24,
  weeks: 60 * 60 * 24 * 7,
};

task(TASK_FAST_FORWARD, 'travel the given amount of time on the current node')
  .addPositionalParam(
    'amount',
    'The amount of time that you want to travel, by default in seconds.',
    undefined,
    types.int
  )
  .addOptionalPositionalParam(
    'unit',
    `Unit of time, should be one of (${Object.keys(units).join('|')})`,
    'seconds',
    types.oneOf(...Object.keys(units))
  )
  .setAction(async ({ amount, unit }) => {
    await hre.ethers.provider.send('evm_mine');

    await fastForward(Number(amount) * units[unit], hre.ethers.provider);

    console.log(`Fast forwarded ${amount} ${unit}`);
  });
