const { task } = require('hardhat/config');
const inquirer = require('inquirer');
const chalk = require('chalk');
const types = require('@synthetixio/core-js/utils/hardhat/argument-types');
const { formatDate } = require('@synthetixio/core-js/utils/misc/dates');
const logger = require('@synthetixio/core-js/utils/io/logger');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');
const assertPeriod = require('../internal/assert-period');
const getPackageProxy = require('../internal/get-package-proxy');
const getPeriodDate = require('../internal/get-period-date');
const getTimestamp = require('../internal/get-timestamp');
const { COUNCILS, ElectionPeriod } = require('../internal/constants');

task('governance', 'CLI tools for managing Synthetix governance projects')
  .addOptionalParam('instance', 'Deployment instance name', 'official', types.alphanumeric)
  .setAction(async ({ instance }, hre) => {
    //eslint-disable-next-line no-constant-condition
    while (true) {
      const timestamp = await getTimestamp(hre);
      const blockNumber = await hre.ethers.provider.getBlockNumber();

      const time = new Date(timestamp * 1000);

      logger.boxStart();
      logger.log(chalk.gray(`Network: ${hre.network.name}`));
      logger.log(chalk.gray(`BlockNumber: ${blockNumber}`));
      logger.log(chalk.gray(`BlockTimestamp: ${timestamp} (${formatDate(time)})`));
      logger.log(chalk.gray(`Url: ${hre.network.config.url}`));
      logger.boxEnd();

      const councils = await initCouncils(hre, instance);
      const choices = [];

      await asyncForEach(councils, async (council) => {
        const { name, currentPeriod, Proxy } = council;
        const councilChoices = [];

        councilChoices.push(
          new inquirer.Separator(name.toLocaleUpperCase().replace('-', ' ')),
          new inquirer.Separator(`  Current Period: ${currentPeriod}`)
        );

        if (currentPeriod === 'Nomination') {
          const candidates = await Proxy.getNominees();
          const snapshotId = await Proxy.getDebtShareSnapshotId().catch(() => '0');

          councilChoices.push(
            new inquirer.Separator(`  Nominees Count: ${candidates.length}`),
            new inquirer.Separator(`  DebtShareSnapshotId: ${snapshotId}`),
            {
              name: '  Set debt share snapshot id (latest)',
              value: {
                type: 'run',
                name: 'governance:set-debt-share-snapshot-id',
                args: { instance, council: name },
              },
            },
            {
              name: '  Fixture nominees (14)',
              value: {
                type: 'run',
                name: 'fixture:candidates',
                args: { instance, council: name, nominateAmount: '14' },
              },
            }
          );
        } else if (currentPeriod === 'Vote') {
          councilChoices.push({
            name: '  Fixture votes (20)',
            value: {
              type: 'run',
              name: 'fixture:votes',
              args: { instance, council: name, nominateAmount: '20' },
            },
          });
        } else if (currentPeriod === 'Evaluation') {
          councilChoices.push({
            name: '  Evaluate election',
            value: {
              type: 'run',
              name: 'governance:evaluate-election',
              args: { instance, council: name },
            },
          });
        }

        if (currentPeriod !== 'Evaluation') {
          const nextPeriod = getNext(Object.keys(ElectionPeriod), currentPeriod);
          const nextPeriodDate = await getPeriodDate(Proxy, nextPeriod);
          councilChoices.push({
            name: `  Fast forward "${nextPeriod}" period (timestamp: ${nextPeriodDate})`,
            value: {
              type: 'run',
              name: 'fast-forward-to',
              args: { instance, council: name, period: nextPeriod },
            },
          });
        }

        choices.push(...councilChoices);
      });

      const { response } = await inquirer.prompt({
        type: 'list',
        name: 'response',
        message: 'What action do you want to perform?',
        pageSize: 20,
        choices,
      });

      if (response.type === 'run') {
        await hre.run(response.name, response.args);
        continue;
      }
    }
  });

task('governance:set-debt-share-snapshot-id', 'Call ElectioModule.setDebtShareSnapshotId')
  .addOptionalParam('instance', 'Deployment instance name', 'official', types.alphanumeric)
  .addParam('council', 'Target council deployment', undefined, types.oneOf(...COUNCILS))
  .addOptionalParam('snapshotId', 'Snapshot id to set, if missing latest will be used')
  .setAction(async ({ instance, council, snapshotId }, hre) => {
    const Proxy = await getPackageProxy(hre, council, instance);

    await assertPeriod(Proxy, 'Nomination');

    if (!snapshotId) {
      const address = await Proxy.getDebtShareContract();
      const SynthetixDebtShare = await hre.ethers.getContractAt(
        [
          {
            constant: true,
            inputs: [],
            name: 'currentPeriodId',
            outputs: [{ internalType: 'uint128', name: '', type: 'uint128' }],
            payable: false,
            stateMutability: 'view',
            type: 'function',
          },
        ],
        address
      );
      snapshotId = await SynthetixDebtShare.currentPeriodId();
    }

    logger.log(`Setting snapshot id "${snapshotId}" for "${council}"`);

    const tx = await Proxy.setDebtShareSnapshotId(snapshotId);
    await tx.wait();

    logger.success(`Done (tx: ${tx.hash})`);
  });

task('governance:evaluate-election', 'Evaluate election of given council')
  .addOptionalParam('instance', 'Deployment instance name', 'official', types.alphanumeric)
  .addParam('council', 'Target council deployment', undefined, types.oneOf(...COUNCILS))
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
          logger.info(`Election evaluated (tx: ${tx.hash})`);
          logger.info(`  epochIndex: ${Number(evaluatedEvent.args.epochIndex)}`);
          logger.info(`  totalBallots: ${Number(evaluatedEvent.args.totalBallots)}`);
          logger.log('');
          break;
        }

        const batchEvent = findEvent({ receipt, eventName: 'ElectionBatchEvaluated' });
        if (batchEvent) {
          logger.info(`Election batch evaluated (tx: ${tx.hash})`);
          logger.info(`  epochIndex: ${Number(evaluatedEvent.args.epochIndex)}`);
          logger.info(`  evaluatedBallots: ${Number(evaluatedEvent.args.evaluatedBallots)}`);
          logger.log('');
          continue;
        }

        throw new Error('Election evaluation did not finish correctly');
      }
    }

    logger.log('Resolving election...');

    const tx = await Proxy.resolve();
    const receipt = await tx.wait();

    logger.success(`Election resolved (tx: ${tx.hash})`);

    const epochStartedEvent = findEvent({ receipt, eventName: 'EpochStarted' });
    logger.info(`Started new epoch index ${epochStartedEvent.args.epochIndex}\n`);

    const members = await Proxy.getCouncilMembers();
    logger.log(chalk.gray(`Current council members (${members.length}):`));
    members.forEach((address) => logger.info(address));
  });

async function initCouncils(hre, instance) {
  return await Promise.all(
    COUNCILS.map(async (name) => {
      const council = { name };
      council.Proxy = await getPackageProxy(hre, name, instance);
      council.currentPeriod = Object.keys(ElectionPeriod)[await council.Proxy.getCurrentPeriod()];
      return council;
    })
  );
}

function getNext(arr, curr) {
  if (!Array.isArray(arr)) throw new Error('Expected array value');
  const currIndex = arr.findIndex((val) => val === curr);
  if (currIndex === -1) throw new Error(`Item "${curr}" not found in "${JSON.stringify(arr)}"`);
  return arr[currIndex === arr.length - 1 ? 0 : currIndex + 1];
}

async function asyncForEach(arr, fn) {
  return await Promise.all(arr.map(fn));
}
