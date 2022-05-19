const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const {
  getTime,
  takeSnapshot,
  restoreSnapshot,
  fastForwardTo,
} = require('@synthetixio/core-js/utils/hardhat/rpc');
const { daysToSeconds } = require('@synthetixio/core-js/utils/misc/dates');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');

module.exports = function(getElectionModule) {
  describe('Settings', () => {
    let ElectionModule;

    let owner, user;

    let receipt;

    let snapshotId;

    before('take snapshot', async function () {
      snapshotId = await takeSnapshot(ethers.provider);
    });

    after('restore snapshot', async function () {
      await restoreSnapshot(snapshotId, ethers.provider);
    });

    before('identify signers', async () => {
      [owner, user] = await ethers.getSigners();
    });

    before('retrieve the election module', async function () {
      ElectionModule = await getElectionModule();
    });

    // ---------------------------------------
    // minimumActiveMembers
    // ---------------------------------------

    describe('when configuring the minimum active members', function () {
      describe('with an account that is not the owner', () => {
        it('reverts', async () => {
          await assertRevert(
            ElectionModule.connect(user).setMinimumActiveMembers(1),
            'Unauthorized'
          );
        });
      });

      describe('with the owner', () => {
        describe('with zero', () => {
          it('reverts', async () => {
            await assertRevert(
              ElectionModule.setMinimumActiveMembers(0),
              'InvalidMinimumActiveMembers'
            );
          });
        });

        describe('with a value that is too big', () => {
          it('reverts', async () => {
            await assertRevert(ElectionModule.setMinimumActiveMembers(1000), 'value out-of-bounds');
          });
        });

        describe('with valid parameters', () => {
          let newMinimumActiveMembers = 3;

          before('set', async () => {
            const tx = await ElectionModule.setMinimumActiveMembers(newMinimumActiveMembers);
            receipt = await tx.wait();
          });

          it('emitted an MinimumActiveMembersChanged event', async function () {
            const event = findEvent({ receipt, eventName: 'MinimumActiveMembersChanged' });

            assert.ok(event);
            assertBn.equal(event.args.minimumActiveMembers, newMinimumActiveMembers);
          });

          it('changes the setting', async () => {
            assertBn.equal(await ElectionModule.getMinimumActiveMembers(), newMinimumActiveMembers);
          });
        });
      });
    });

    // ---------------------------------------
    // nextEpochSeatCount
    // ---------------------------------------

    describe('when configuring the next epoch seat count', function () {
      describe('with an account that is not the owner', () => {
        it('reverts', async () => {
          await assertRevert(ElectionModule.connect(user).setNextEpochSeatCount(1), 'Unauthorized');
        });
      });

      describe('with the owner', () => {
        describe('with zero', () => {
          it('reverts', async () => {
            await assertRevert(ElectionModule.setNextEpochSeatCount(0), 'InvalidElectionSettings');
          });
        });

        describe('with a value that is too big', () => {
          it('reverts', async () => {
            await assertRevert(ElectionModule.setNextEpochSeatCount(1000), 'value out-of-bounds');
          });
        });

        describe('with valid parameters', () => {
          let newNextEpochSeatCount = 8;

          describe('in the nominations period', function () {
            let snapshotId;

            before('take snapshot and fast forward', async function () {
              snapshotId = await takeSnapshot(ethers.provider);

              await fastForwardTo(
                await ElectionModule.getNominationPeriodStartDate(),
                ethers.provider
              );
            });

            after('restore snapshot', async function () {
              await restoreSnapshot(snapshotId, ethers.provider);
            });

            it('reverts', async function () {
              await assertRevert(
                ElectionModule.setNextEpochSeatCount(42),
                'NotCallableInCurrentPeriod'
              );
            });
          });

          describe('in the voting period', function () {
            let snapshotId;

            before('take snapshot and fast forward', async function () {
              snapshotId = await takeSnapshot(ethers.provider);

              await fastForwardTo(await ElectionModule.getVotingPeriodStartDate(), ethers.provider);
            });

            after('restore snapshot', async function () {
              await restoreSnapshot(snapshotId, ethers.provider);
            });

            it('reverts', async function () {
              await assertRevert(
                ElectionModule.setNextEpochSeatCount(42),
                'NotCallableInCurrentPeriod'
              );
            });
          });

          describe('in the idle period', function () {
            before('set', async () => {
              const tx = await ElectionModule.setNextEpochSeatCount(newNextEpochSeatCount);
              receipt = await tx.wait();
            });

            it('emitted an NextEpochSeatCountChanged event', async function () {
              const event = findEvent({ receipt, eventName: 'NextEpochSeatCountChanged' });

              assert.ok(event);
              assertBn.equal(event.args.seatCount, newNextEpochSeatCount);
            });

            it('changes the setting', async () => {
              assertBn.equal(await ElectionModule.getNextEpochSeatCount(), newNextEpochSeatCount);
            });
          });
        });
      });
    });

    // ---------------------------------------
    // defaultBallotEvaluationBatchSize
    // ---------------------------------------

    describe('when configuring the default ballot evaluation batch size', function () {
      describe('with an account that is not the owner', () => {
        it('reverts', async () => {
          await assertRevert(
            ElectionModule.connect(user).setDefaultBallotEvaluationBatchSize(1),
            'Unauthorized'
          );
        });
      });

      describe('with the owner', () => {
        describe('with zero', () => {
          it('reverts', async () => {
            await assertRevert(
              ElectionModule.setDefaultBallotEvaluationBatchSize(0),
              'InvalidElectionSettings'
            );
          });
        });

        describe('with valid parameters', () => {
          let newDefaultBallotEvaluationBatchSize = 100;

          before('set', async () => {
            const tx = await ElectionModule.setDefaultBallotEvaluationBatchSize(
              newDefaultBallotEvaluationBatchSize
            );
            receipt = await tx.wait();
          });

          it('emitted an DefaultBallotEvaluationBatchSizeChanged event', async function () {
            const event = findEvent({
              receipt,
              eventName: 'DefaultBallotEvaluationBatchSizeChanged',
            });

            assert.ok(event);
            assertBn.equal(event.args.size, newDefaultBallotEvaluationBatchSize);
          });

          it('changes the setting', async () => {
            assertBn.equal(
              await ElectionModule.getDefaultBallotEvaluationBatchSize(),
              newDefaultBallotEvaluationBatchSize
            );
          });
        });
      });
    });

    // ---------------------------------------
    // maxDateAdjustmentTolerance
    // ---------------------------------------

    describe('when configuring maximum epoch date adjustment tolerance', function () {
      describe('with an account that is not the owner', () => {
        it('reverts', async () => {
          await assertRevert(
            ElectionModule.connect(user).setMaxDateAdjustmentTolerance(1),
            'Unauthorized'
          );
        });
      });

      describe('with the owner', () => {
        describe('with any zero duration', () => {
          it('reverts', async () => {
            await assertRevert(
              ElectionModule.setMaxDateAdjustmentTolerance(0),
              'InvalidElectionSettings'
            );
          });
        });

        describe('with valid parameters', () => {
          let newMaxDateAdjustmentTolerance = daysToSeconds(1);

          before('set', async () => {
            const tx = await ElectionModule.setMaxDateAdjustmentTolerance(
              newMaxDateAdjustmentTolerance
            );
            receipt = await tx.wait();
          });

          it('emitted an MaxDateAdjustmentToleranceChanged event', async function () {
            const event = findEvent({ receipt, eventName: 'MaxDateAdjustmentToleranceChanged' });

            assert.ok(event);
            assertBn.equal(event.args.tolerance, newMaxDateAdjustmentTolerance);
          });

          it('changes the setting', async () => {
            assertBn.equal(
              await ElectionModule.getMaxDateAdjustmenTolerance(),
              newMaxDateAdjustmentTolerance
            );
          });
        });
      });
    });

    // ---------------------------------------
    // minEpochDuration
    // minNominationPeriodDuration
    // minVotingPeriodDuration
    // ---------------------------------------

    describe('when configuring minimum epoch and period durations', function () {
      describe('with an account that is not the owner', () => {
        it('reverts', async () => {
          await assertRevert(
            ElectionModule.connect(user).setMinEpochDurations(1, 1, 1),
            'Unauthorized'
          );
        });
      });

      describe('with the owner', () => {
        describe('with any zero duration', () => {
          it('reverts', async () => {
            await assertRevert(
              ElectionModule.setMinEpochDurations(1, 1, 0),
              'InvalidElectionSettings'
            );
            await assertRevert(
              ElectionModule.setMinEpochDurations(1, 0, 1),
              'InvalidElectionSettings'
            );
            await assertRevert(
              ElectionModule.setMinEpochDurations(0, 1, 1),
              'InvalidElectionSettings'
            );
          });
        });

        describe('with valid parameters', () => {
          let newMinNominationPeriodDuration = daysToSeconds(1);
          let newMinVotingPeriodDuration = daysToSeconds(3);
          let newMinEpochDuration = daysToSeconds(365);

          before('set', async () => {
            const tx = await ElectionModule.setMinEpochDurations(
              newMinNominationPeriodDuration,
              newMinVotingPeriodDuration,
              newMinEpochDuration
            );
            receipt = await tx.wait();
          });

          it('emitted an MinimumEpochDurationsChanged event', async function () {
            const event = findEvent({ receipt, eventName: 'MinimumEpochDurationsChanged' });

            assert.ok(event);
            assertBn.equal(event.args.minNominationPeriodDuration, newMinNominationPeriodDuration);
            assertBn.equal(event.args.minVotingPeriodDuration, newMinVotingPeriodDuration);
            assertBn.equal(event.args.minEpochDuration, newMinEpochDuration);
          });

          it('changes the setting', async () => {
            const [
              setMinNominationPeriodDuration,
              setMinVotingPeriodDuration,
              setMinEpochDuration,
            ] = await ElectionModule.getMinEpochDurations();

            assertBn.equal(setMinNominationPeriodDuration, newMinNominationPeriodDuration);
            assertBn.equal(setMinVotingPeriodDuration, newMinVotingPeriodDuration);
            assertBn.equal(setMinEpochDuration, newMinEpochDuration);
          });
        });
      });
    });
  });
}
