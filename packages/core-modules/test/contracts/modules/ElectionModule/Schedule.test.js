const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const {
  getTime,
  fastForwardTo,
  takeSnapshot,
  restoreSnapshot,
} = require('@synthetixio/core-js/utils/hardhat/rpc');
const { daysToSeconds } = require('@synthetixio/core-js/utils/misc/dates');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../../helpers/initializer');
const { ElectionPeriod, assertDatesAreClose } = require('./helpers/election-helper');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');

describe('ElectionModule (schedule)', () => {
  const { proxyAddress } = bootstrap(initializer);

  let ElectionModule, ElectionInspectorModule;

  let owner, user;

  let snapshotId;

  let receipt;

  let newNominationPeriodStartDate, newVotingPeriodStartDate, newEpochEndDate;

  before('identify signers', async () => {
    [owner, user] = await ethers.getSigners();
  });

  before('identify modules', async () => {
    ElectionModule = (
      await ethers.getContractAt(
        'contracts/modules/ElectionModule.sol:ElectionModule',
        proxyAddress()
      )
    ).connect(owner);

    ElectionInspectorModule = await ethers.getContractAt(
      'contracts/modules/ElectionInspectorModule.sol:ElectionInspectorModule',
      proxyAddress()
    );
  });

  // ----------------------------------
  // Nomination behavior
  // ----------------------------------

  const itRejectsNominations = () => {
    describe('when trying to call the nominate function', function () {
      it('reverts', async function () {
        await assertRevert(ElectionModule.nominate(), 'NotCallableInCurrentPeriod');
      });
    });

    describe('when trying to call the withdrawNomination function', function () {
      it('reverts', async function () {
        await assertRevert(ElectionModule.nominate(), 'NotCallableInCurrentPeriod');
      });
    });
  };

  const itAcceptsNominations = () => {
    describe('when trying to call the nominate function', function () {
      it('does not revert', async function () {
        await ElectionModule.nominate();
      });
    });

    describe('when a user withdraws its nomination', function () {
      it('does not revert', async function () {
        await ElectionModule.withdrawNomination();
      });
    });
  };

  // ----------------------------------
  // Vote behavior
  // ----------------------------------

  const itRejectsVotes = () => {
    describe('when trying to call the elect function', function () {
      it('reverts', async function () {
        await assertRevert(ElectionModule.cast([user.address]), 'NotCallableInCurrentPeriod');
      });
    });
  };

  const itAcceptsVotes = () => {
    describe('when trying to call the elect function', function () {
      it('does not revert', async function () {
        await ElectionModule.cast([user.address]);
      });
    });
  };

  // ----------------------------------
  // Evaluation behaviors
  // ----------------------------------

  const itRejectsEvaluations = () => {
    describe('when trying to call the evaluate function', function () {
      it('reverts', async function () {
        await assertRevert(ElectionModule.evaluate(0), 'NotCallableInCurrentPeriod');
      });
    });

    describe('when trying to call the resolve function', function () {
      it('reverts', async function () {
        await assertRevert(ElectionModule.evaluate(0), 'NotCallableInCurrentPeriod');
      });
    });
  };

  const itAcceptsEvaluations = () => {
    describe('when trying to call the evaluate function', function () {
      it('does not revert', async function () {
        await ElectionModule.evaluate(0);
      });
    });

    describe('when trying to call the resolve function', function () {
      it('does not revert', async function () {
        await ElectionModule.resolve();
      });
    });
  };

  // ----------------------------------
  // Evaluation behaviors
  // ----------------------------------

  const itRejectsAdjustments = () => {
    describe('when trying to call the tweakEpochSchedule function', function () {
      it('reverts', async function () {
        await assertRevert(
          ElectionModule.tweakEpochSchedule(0, 0, 0),
          'NotCallableInCurrentPeriod'
        );
      });
    });

    describe('when trying to call the modifyEpochSchedule function', function () {
      it('reverts', async function () {
        await assertRevert(
          ElectionModule.modifyEpochSchedule(0, 0, 0),
          'NotCallableInCurrentPeriod'
        );
      });
    });
  };

  const itAcceptsAdjustments = () => {
    describe('when trying to adjust the epoch schedule', function () {
      before('fast forward', async function () {
        await fastForwardTo(
          (await ElectionInspectorModule.getNominationPeriodStartDate()) - daysToSeconds(1),
          ethers.provider
        );
      });

      before('fast forward', async function () {
        await fastForwardTo(
          (await ElectionInspectorModule.getNominationPeriodStartDate()) - daysToSeconds(1),
          ethers.provider
        );
      });

      before('take snapshot', async function () {
        snapshotId = await takeSnapshot(ethers.provider);
      });

      after('restore snapshot', async function () {
        await restoreSnapshot(snapshotId, ethers.provider);
      });

      describe('with zero dates', function () {
        it('reverts', async function () {
          await assertRevert(
            ElectionModule.tweakEpochSchedule(0, 0, 0),
            'InvalidEpochConfiguration'
          );
        });
      });

      describe('with minor changes', function () {
        describe('with dates too far from the current dates', function () {
          it('reverts', async function () {
            const epochEndDate = (await ElectionInspectorModule.getEpochEndDate()).toNumber();
            const nominationPeriodStartDate = (
              await ElectionInspectorModule.getNominationPeriodStartDate()
            ).toNumber();
            const votingPeriodStartDate = (
              await ElectionInspectorModule.getVotingPeriodStartDate()
            ).toNumber();

            await assertRevert(
              ElectionModule.tweakEpochSchedule(
                nominationPeriodStartDate + daysToSeconds(2),
                votingPeriodStartDate + daysToSeconds(2),
                epochEndDate + daysToSeconds(8)
              ),
              'InvalidEpochConfiguration'
            );
            await assertRevert(
              ElectionModule.tweakEpochSchedule(
                nominationPeriodStartDate - daysToSeconds(8),
                votingPeriodStartDate + daysToSeconds(2),
                epochEndDate + daysToSeconds(7)
              ),
              'InvalidEpochConfiguration'
            );
            await assertRevert(
              ElectionModule.tweakEpochSchedule(
                nominationPeriodStartDate + daysToSeconds(2),
                votingPeriodStartDate - daysToSeconds(8),
                epochEndDate + daysToSeconds(7)
              ),
              'InvalidEpochConfiguration'
            );
          });
        });

        describe('with dates close to the current dates', function () {
          describe('which change the current period type', function () {
            it('reverts', async function () {
              await assertRevert(
                ElectionModule.tweakEpochSchedule(
                  (await ElectionInspectorModule.getNominationPeriodStartDate()).toNumber() -
                    daysToSeconds(2),
                  (await ElectionInspectorModule.getVotingPeriodStartDate()).toNumber() +
                    daysToSeconds(0.5),
                  (await ElectionInspectorModule.getEpochEndDate()).toNumber() + daysToSeconds(4)
                ),
                'ChangesCurrentPeriod'
              );
            });
          });

          describe('which dont change the current period type', function () {
            before('adjust', async function () {
              newEpochEndDate =
                (await ElectionInspectorModule.getEpochEndDate()).toNumber() + daysToSeconds(4);
              newNominationPeriodStartDate =
                (await ElectionInspectorModule.getNominationPeriodStartDate()).toNumber() -
                daysToSeconds(0.5);
              newVotingPeriodStartDate =
                (await ElectionInspectorModule.getVotingPeriodStartDate()).toNumber() +
                daysToSeconds(0.5);

              const tx = await ElectionModule.tweakEpochSchedule(
                newNominationPeriodStartDate,
                newVotingPeriodStartDate,
                newEpochEndDate
              );
              receipt = await tx.wait();
            });

            it('emitted an EpochScheduleUpdated event', async function () {
              const event = findEvent({ receipt, eventName: 'EpochScheduleUpdated' });

              assert.ok(event);
              assertBn.equal(event.args.nominationPeriodStartDate, newNominationPeriodStartDate);
              assertBn.equal(event.args.votingPeriodStartDate, newVotingPeriodStartDate);
              assertBn.equal(event.args.epochEndDate, newEpochEndDate);
            });

            it('properly adjusted dates', async function () {
              assertDatesAreClose(
                await ElectionInspectorModule.getNominationPeriodStartDate(),
                newNominationPeriodStartDate
              );
              assertDatesAreClose(
                await ElectionInspectorModule.getVotingPeriodStartDate(),
                newVotingPeriodStartDate
              );
              assertDatesAreClose(await ElectionInspectorModule.getEpochEndDate(), newEpochEndDate);
            });
          });
        });
      });

      describe('with major changes', function () {
        describe('with dates far from the current dates', function () {
          describe('which change the current period type', function () {
            it('reverts', async function () {
              await assertRevert(
                ElectionModule.modifyEpochSchedule(
                  (await ElectionInspectorModule.getNominationPeriodStartDate()).toNumber() -
                    daysToSeconds(2),
                  (await ElectionInspectorModule.getVotingPeriodStartDate()).toNumber() +
                    daysToSeconds(100),
                  (await ElectionInspectorModule.getEpochEndDate()).toNumber() + daysToSeconds(100)
                ),
                'ChangesCurrentPeriod'
              );
            });
          });

          describe('which dont change the current period type', function () {
            before('adjust', async function () {
              newEpochEndDate =
                (await ElectionInspectorModule.getEpochEndDate()).toNumber() + daysToSeconds(100);
              newNominationPeriodStartDate =
                (await ElectionInspectorModule.getNominationPeriodStartDate()).toNumber() +
                daysToSeconds(100);
              newVotingPeriodStartDate =
                (await ElectionInspectorModule.getVotingPeriodStartDate()).toNumber() +
                daysToSeconds(100);

              const tx = await ElectionModule.modifyEpochSchedule(
                newNominationPeriodStartDate,
                newVotingPeriodStartDate,
                newEpochEndDate
              );
              receipt = await tx.wait();
            });

            it('emitted an EpochScheduleUpdated event', async function () {
              const event = findEvent({ receipt, eventName: 'EpochScheduleUpdated' });

              assert.ok(event);
              assertBn.equal(event.args.nominationPeriodStartDate, newNominationPeriodStartDate);
              assertBn.equal(event.args.votingPeriodStartDate, newVotingPeriodStartDate);
              assertBn.equal(event.args.epochEndDate, newEpochEndDate);
            });

            it('properly adjusted dates', async function () {
              assertDatesAreClose(
                await ElectionInspectorModule.getNominationPeriodStartDate(),
                newNominationPeriodStartDate
              );
              assertDatesAreClose(
                await ElectionInspectorModule.getVotingPeriodStartDate(),
                newVotingPeriodStartDate
              );
              assertDatesAreClose(await ElectionInspectorModule.getEpochEndDate(), newEpochEndDate);
            });
          });
        });
      });
    });
  };

  // ----------------------------------
  // Administration period
  // ----------------------------------

  describe('when the module is initialized', function () {
    before('initialize', async function () {
      const now = await getTime(ethers.provider);
      const epochEndDate = now + daysToSeconds(90);
      const votingPeriodStartDate = epochEndDate - daysToSeconds(7);
      const nominationPeriodStartDate = votingPeriodStartDate - daysToSeconds(7);

      await ElectionModule.initializeElectionModule(
        'Spartan Council Token',
        'SCT',
        [owner.address],
        1,
        nominationPeriodStartDate,
        votingPeriodStartDate,
        epochEndDate
      );
    });

    it('shows that initial period is Administration', async function () {
      assertBn.equal(
        await ElectionInspectorModule.getCurrentPeriod(),
        ElectionPeriod.Administration
      );
    });

    describe('when an account that does not own the instance attempts to adjust the epoch', function () {
      it('reverts', async function () {
        await assertRevert(
          ElectionModule.connect(user).tweakEpochSchedule(0, 0, 0),
          'Unauthorized'
        );
      });
    });

    describe('when an account that does not own the instance attempts to unsafely adjust the epoch', function () {
      it('reverts', async function () {
        await assertRevert(
          ElectionModule.connect(user).modifyEpochSchedule(0, 0, 0),
          'Unauthorized'
        );
      });
    });

    describe('while in the Administration period', function () {
      itRejectsNominations();
      itRejectsVotes();
      itRejectsEvaluations();
      itAcceptsAdjustments();
    });

    // ----------------------------------
    // Nomination period
    // ----------------------------------

    describe('when entering the nomination period', function () {
      before('fast forward', async function () {
        await fastForwardTo(
          await ElectionInspectorModule.getNominationPeriodStartDate(),
          ethers.provider
        );
      });

      it('skipped to the target time', async function () {
        assertDatesAreClose(
          await getTime(ethers.provider),
          await ElectionInspectorModule.getNominationPeriodStartDate()
        );
      });

      it('shows that the current period is Nomination', async function () {
        assertBn.equal(await ElectionInspectorModule.getCurrentPeriod(), ElectionPeriod.Nomination);
      });

      itAcceptsNominations();
      itRejectsVotes();
      itRejectsEvaluations();
      itRejectsAdjustments();
    });

    // ----------------------------------
    // Vote period
    // ----------------------------------

    describe('when entering the voting period', function () {
      before('ensure nominations', async function () {
        await ElectionModule.connect(user).nominate();
      });

      before('fast forward', async function () {
        await fastForwardTo(
          await ElectionInspectorModule.getVotingPeriodStartDate(),
          ethers.provider
        );
      });

      it('skipped to the target time', async function () {
        assertDatesAreClose(
          await getTime(ethers.provider),
          await ElectionInspectorModule.getVotingPeriodStartDate()
        );
      });

      it('shows that the current period is Vote', async function () {
        assertBn.equal(await ElectionInspectorModule.getCurrentPeriod(), ElectionPeriod.Vote);
      });

      itRejectsNominations();
      itAcceptsVotes();
      itRejectsEvaluations();
      itRejectsAdjustments();
    });

    // ----------------------------------
    // Evaluation period
    // ----------------------------------

    describe('when entering the evaluation period', function () {
      before('fast forward', async function () {
        await fastForwardTo(await ElectionInspectorModule.getEpochEndDate(), ethers.provider);
      });

      it('skipped to the target time', async function () {
        assertDatesAreClose(
          await getTime(ethers.provider),
          await ElectionInspectorModule.getEpochEndDate()
        );
      });

      it('shows that the current period is Evaluation', async function () {
        assertBn.equal(await ElectionInspectorModule.getCurrentPeriod(), ElectionPeriod.Evaluation);
      });

      itRejectsNominations();
      itRejectsVotes();
      itRejectsAdjustments();
      itAcceptsEvaluations();
    });
  });
});
