const { task } = require('hardhat/config');
// const { fastForwardTo } = require('@synthetixio/core-js/utils/hardhat/rpc');
const types = require('@synthetixio/core-js/utils/hardhat/argument-types');
const logger = require('@synthetixio/core-js/utils/io/logger');
const { COUNCILS } = require('../internal/constants');
const getPackageProxy = require('../internal/get-package-proxy');
const getPeriodDate = require('../internal/get-period-date');
const { periods } = require('../internal/get-period-date');
const getTimestamp = require('../internal/get-timestamp');

task('fast-forward-to', 'skips time to the specified election period')
  .addOptionalParam('time', 'Time to fast forward to', undefined, types.int)
  .addOptionalParam('instance', 'Deployment instance name', 'official', types.alphanumeric)
  .addOptionalParam('council', 'Target council deployment', undefined, types.oneOf(...COUNCILS))
  .addOptionalParam(
    'period',
    `Future period you want to fast forward to in time, should be one of ${periods.join(', ')}`,
    undefined,
    types.oneOf(...periods)
  )
  .setAction(async ({ time, instance, council, period }, hre) => {
    if (time) {
      time = Number(time);
      await fastForwardTo(hre, time);
      logger.log(`Fast forwarded to ${time}`);
      return time;
    }

    const Proxy = await getPackageProxy(hre, council, instance);

    // necessary on first run, if not the next fastForwardTo() call does not work.
    if (['local', 'localhost', 'hardhat'].includes(hre.network.name)) {
      await hre.ethers.provider.send('evm_mine');
    }

    const periodTime = await getPeriodDate(Proxy, period);

    await fastForwardTo(hre, periodTime);

    logger.log(`Fast forwarded to ${period} period (${periodTime})`);

    return periodTime;
  });

/**
 * When calculating the amount of fastforwarding we want to do, we have to use
 * the timestamp that's on the contract, and not the timestamp from the last block.
 * This is only a problem only when using forks, as there are not new blocks being
 * generated.
 */
async function fastForwardTo(hre, time) {
  const now = await getTimestamp(hre);

  if (time < now) {
    throw new Error('Cannot fast forward to a past date.');
  }

  await hre.ethers.provider.send('evm_increaseTime', [time - now]);
}
