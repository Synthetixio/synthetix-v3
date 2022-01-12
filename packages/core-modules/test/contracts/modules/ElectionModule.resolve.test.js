const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { fastForwardTo } = require('@synthetixio/core-js/utils/hardhat/rpc');
const { getUnixTimestamp, daysToSeconds } = require('@synthetixio/core-js/utils/misc/dates');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');
const { EpochStatus } = require('../../helpers/election-helper');

describe('ElectionModule (resolve)', () => {
  const { proxyAddress } = bootstrap(initializer);

  let ElectionModule;

  let epochEndDate, nominationPeriodStartDate, votingPeriodStartDate;
  let epochIndexBefore;

  before('identify modules', async () => {
    ElectionModule = await ethers.getContractAt('ElectionModule', proxyAddress());
  });

  describe('when the module is initialized', function () {
    before('initialize', async function () {
      const now = getUnixTimestamp();

      epochEndDate = now + daysToSeconds(90);
      votingPeriodStartDate = epochEndDate - daysToSeconds(7);
      nominationPeriodStartDate = votingPeriodStartDate - daysToSeconds(7);

      await ElectionModule.initializeElectionModule(
        epochEndDate,
        nominationPeriodStartDate,
        votingPeriodStartDate
      );
    });

    describe('when entering the evaluation period', function () {
      before('fast forward', async function () {
        await fastForwardTo(epochEndDate, ethers.provider);
      });

      it('shows that the current status is Evaluating', async function () {
        assertBn.eq(await ElectionModule.getEpochStatus(), EpochStatus.Evaluating);
      });

      describe('before evaluating the epoch', function () {
        describe('when trying to resolve the epoch', function () {
          it('reverts', async function () {
            await assertRevert(ElectionModule.resolve(), 'EpochNotEvaluated');
          });
        });
      });

      describe('when evaluating the epoch', function () {
        before('evaluate', async function () {
          await ElectionModule.evaluate();
        });

        it('shows that the epoch is evaluated', async function () {
          assert.ok(await ElectionModule.isCurrentEpochEvaluated());
        });

        describe('when resolving the epoch', function () {
          before('record the epoch index', async function () {
            epochIndexBefore = await ElectionModule.getEpochIndex();
          });

          before('resolve', async function () {
            await ElectionModule.resolve();
          });

          describe('when a new epoch starts', function () {
            it('shows that the epoch index increased', async function () {
              const epochIndexAfter = await ElectionModule.getEpochIndex();

              assertBn.eq(epochIndexAfter, epochIndexBefore.add(1));
            });

            it('shows that the current status is Idle', async function () {
              assertBn.eq(await ElectionModule.getEpochStatus(), EpochStatus.Idle);
            });
          });
        });
      });
    });
  });
});
