const { task } = require('hardhat/config');
const { fastForwardTo } = require('@synthetixio/core-js/utils/hardhat/rpc');
const types = require('@synthetixio/core-js/utils/hardhat/argument-types');
const { COUNCILS } = require('../internal/constants');
const getPackageProxy = require('../internal/get-package-proxy');
const getPeriodDate = require('../internal/get-period-date');

task('fast-forward-to', 'skips time to the specified election period')
  .addOptionalParam('instance', 'Deployment instance name', 'official', types.alphanumeric)
  .addParam(
    'council',
    'From which council to take the period time',
    undefined,
    types.oneOf(...COUNCILS)
  )
  .addPositionalParam(
    'period',
    `Future period you want to fast forward to in time, should be one of ${getPeriodDate.periods.join(
      ', '
    )}`,
    undefined,
    types.oneOf(...getPeriodDate.periods)
  )
  .setAction(async ({ instance, council, period }, hre) => {
    const Proxy = await getPackageProxy(hre, council, instance);

    // necessary on first run, if not the next fastForwardTo() call does not work.
    if (['local', 'localhost', 'hardhat'].includes(hre.network.name)) {
      await hre.ethers.provider.send('evm_mine');
    }

    const time = await getPeriodDate(Proxy, period);

    await fastForwardTo(time, hre.ethers.provider);

    console.log(`Fast forwarded to ${period} period (${time})`);

    return time;
  });
