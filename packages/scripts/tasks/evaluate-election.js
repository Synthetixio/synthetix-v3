const { task } = require('hardhat/config');
const types = require('@synthetixio/core-js/utils/hardhat/argument-types');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');
const logger = require('@synthetixio/core-js/utils/io/logger');
const { COUNCILS } = require('../internal/constants');
const assertPeriod = require('../internal/assert-period');
const getPackageProxy = require('../internal/get-package-proxy');

task('evaluate-election', 'Evaluate election of given council')
  .addOptionalParam('instance', 'Deployment instance name', 'official', types.alphanumeric)
  .addParam(
    'council',
    'From which council to take the period time',
    undefined,
    types.oneOf(...COUNCILS)
  )
  .setAction(async ({ instance, council }, hre) => {
    const Proxy = await getPackageProxy(hre, council, instance);

    await assertPeriod(Proxy, 'Evaluation');

    logger.log(`Evaluating & resolving election for "${council}"`);

    const evaluated = await Proxy.isElectionEvaluated();

    if (evaluated) {
      logger.info('Election already evaluated...');
    } else {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const tx = await Proxy.evaluate(0);
        const receipt = await tx.wait();

        const evaluatedEvent = findEvent({ receipt, eventName: 'ElectionEvaluated' });
        if (evaluatedEvent) {
          logger.info('Election evaluated');
          logger.info('  epochIndex: ', Number(evaluatedEvent.args.epochIndex));
          logger.info('  totalBallots: ', Number(evaluatedEvent.args.totalBallots));
          logger.log('');
          break;
        }

        const batchEvent = findEvent({ receipt, eventName: 'ElectionBatchEvaluated' });
        if (batchEvent) {
          logger.info(batchEvent);
          logger.info('Election batch evaluated');
          logger.info('  epochIndex: ', Number(evaluatedEvent.args.epochIndex));
          logger.info('  evaluatedBallots: ', Number(evaluatedEvent.args.evaluatedBallots));
          logger.log('');
          continue;
        }

        throw new Error('Election evaluation did not finish correctly');
      }
    }

    logger.info('Resolving election...');

    const tx = await Proxy.resolve();
    const receipt = await tx.wait();
    const epochStartedEvent = findEvent({ receipt, eventName: 'EpochStarted' });

    logger.info(
      `Election resolved, started new epoch index ${epochStartedEvent.args.epochIndex}\n`
    );

    const members = await Proxy.getCouncilMembers();
    logger.info(`Current council members (${members.length}):`);
    members.forEach((address) => logger.info('  - ', address));
  });
