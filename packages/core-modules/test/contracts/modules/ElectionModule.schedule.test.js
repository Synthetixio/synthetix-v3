const { ethers } = hre;
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
const initializer = require('../../helpers/initializer');
const { ElectionPeriod, assertDatesAreClose } = require('../../helpers/election-helper');

describe('ElectionModule (schedule)', () => {
  const { proxyAddress } = bootstrap(initializer);

  let ElectionModule;

  let owner, user;

  let snapshotId;

  before('identify signers', async () => {
    [owner, user] = await ethers.getSigners();
  });

  before('identify modules', async () => {
    ElectionModule = (await ethers.getContractAt('ElectionModule', proxyAddress())).connect(owner);
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
        await assertRevert(ElectionModule.elect([user.address]), 'NotCallableInCurrentPeriod');
      });
    });
  };

  const itAcceptsVotes = () => {
    describe('when trying to call the elect function', function () {
      it('does not revert', async function () {
        await ElectionModule.elect([user.address]);
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
    describe('when trying to call the adjustEpochSchedule function', function () {
      it('reverts', async function () {
        await assertRevert(
          ElectionModule.adjustEpochSchedule(0, 0, 0),
          'NotCallableInCurrentPeriod'
        );
      });
    });

    describe('when trying to call the unsafeAdjustEpochSchedule function', function () {
      it('reverts', async function () {
        await assertRevert(
          ElectionModule.unsafeAdjustEpochSchedule(0, 0, 0),
          'NotCallableInCurrentPeriod'
        );
      });
    });
  };

  const itAcceptsAdjustments = () => {
    describe('when trying to adjust the epoch schedule', function () {
      let newEpochEndDate, newNominationPeriodStartDate, newVotingPeriodStartDate;

      before('take snapshot', async function () {
        snapshotId = await takeSnapshot(ethers.provider);
      });

      after('restore snapshot', async function () {
        await restoreSnapshot(snapshotId, ethers.provider);
      });

      describe('with zero dates', function () {
        it('reverts', async function () {
          await assertRevert(
            ElectionModule.adjustEpochSchedule(0, 0, 0),
            'InvalidEpochConfiguration'
          );
        });
      });

      describe('safely', function () {
        describe('with dates too far from the current dates', function () {
          it('reverts', async function () {
            const epochEndDate = (await ElectionModule.getEpochEndDate()).toNumber();
            const nominationPeriodStartDate = (
              await ElectionModule.getNominationPeriodStartDate()
            ).toNumber();
            const votingPeriodStartDate = (
              await ElectionModule.getVotingPeriodStartDate()
            ).toNumber();

            await assertRevert(
              ElectionModule.adjustEpochSchedule(
                nominationPeriodStartDate + daysToSeconds(2),
                votingPeriodStartDate + daysToSeconds(2),
                epochEndDate + daysToSeconds(8)
              ),
              'InvalidEpochConfiguration'
            );
            await assertRevert(
              ElectionModule.adjustEpochSchedule(
                nominationPeriodStartDate - daysToSeconds(8),
                votingPeriodStartDate + daysToSeconds(2),
                epochEndDate + daysToSeconds(7)
              ),
              'InvalidEpochConfiguration'
            );
            await assertRevert(
              ElectionModule.adjustEpochSchedule(
                nominationPeriodStartDate + daysToSeconds(2),
                votingPeriodStartDate - daysToSeconds(8),
                epochEndDate + daysToSeconds(7)
              ),
              'InvalidEpochConfiguration'
            );
          });
        });

        describe('with dates close to the current dates', function () {
          before('adjust', async function () {
            newEpochEndDate =
              (await ElectionModule.getEpochEndDate()).toNumber() + daysToSeconds(4);
            newNominationPeriodStartDate =
              (await ElectionModule.getNominationPeriodStartDate()).toNumber() - daysToSeconds(2);
            newVotingPeriodStartDate =
              (await ElectionModule.getVotingPeriodStartDate()).toNumber() + daysToSeconds(0.5);

            await ElectionModule.adjustEpochSchedule(
              newNominationPeriodStartDate,
              newVotingPeriodStartDate,
              newEpochEndDate
            );
          });

          it('properly adjusted dates', async function () {
            assertDatesAreClose(
              await ElectionModule.getNominationPeriodStartDate(),
              newNominationPeriodStartDate
            );
            assertDatesAreClose(
              await ElectionModule.getVotingPeriodStartDate(),
              newVotingPeriodStartDate
            );
            assertDatesAreClose(await ElectionModule.getEpochEndDate(), newEpochEndDate);
          });
        });
      });

      describe('unsafely', function () {
        describe('with dates far from the current dates', function () {
          before('adjust', async function () {
            newEpochEndDate =
              (await ElectionModule.getEpochEndDate()).toNumber() + daysToSeconds(100);
            newNominationPeriodStartDate =
              (await ElectionModule.getNominationPeriodStartDate()).toNumber() + daysToSeconds(100);
            newVotingPeriodStartDate =
              (await ElectionModule.getVotingPeriodStartDate()).toNumber() + daysToSeconds(100);

            await ElectionModule.unsafeAdjustEpochSchedule(
              newNominationPeriodStartDate,
              newVotingPeriodStartDate,
              newEpochEndDate
            );
          });

          it('properly adjusted dates', async function () {
            assertDatesAreClose(
              await ElectionModule.getNominationPeriodStartDate(),
              newNominationPeriodStartDate
            );
            assertDatesAreClose(
              await ElectionModule.getVotingPeriodStartDate(),
              newVotingPeriodStartDate
            );
            assertDatesAreClose(await ElectionModule.getEpochEndDate(), newEpochEndDate);
          });
        });
      });
    });
  };

  // ----------------------------------
  // Idle period
  // ----------------------------------

  describe('when the module is initialized', function () {
    before('initialize', async function () {
      const now = await getTime(ethers.provider);
      const epochEndDate = now + daysToSeconds(90);
      const votingPeriodStartDate = epochEndDate - daysToSeconds(7);
      const nominationPeriodStartDate = votingPeriodStartDate - daysToSeconds(7);

      await ElectionModule.initializeElectionModule(
        nominationPeriodStartDate,
        votingPeriodStartDate,
        epochEndDate
      );
    });

    it('shows that initial period is Idle', async function () {
      assertBn.eq(await ElectionModule.getCurrentPeriodType(), ElectionPeriod.Idle);
    });

    describe('when an account that does not own the instance attempts to adjust the epoch', function () {
      it('reverts', async function () {
        await assertRevert(
          ElectionModule.connect(user).adjustEpochSchedule(0, 0, 0),
          'Unauthorized'
        );
      });
    });

    describe('when an account that does not own the instance attempts to unsafely adjust the epoch', function () {
      it('reverts', async function () {
        await assertRevert(
          ElectionModule.connect(user).unsafeAdjustEpochSchedule(0, 0, 0),
          'Unauthorized'
        );
      });
    });

    describe('while in the Idle period', function () {
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
        await fastForwardTo(await ElectionModule.getNominationPeriodStartDate(), ethers.provider);
      });

      it('skipped to the target time', async function () {
        assertDatesAreClose(
          await getTime(ethers.provider),
          await ElectionModule.getNominationPeriodStartDate()
        );
      });

      it('shows that the current period is Nomination', async function () {
        assertBn.eq(await ElectionModule.getCurrentPeriodType(), ElectionPeriod.Nomination);
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
        await fastForwardTo(await ElectionModule.getVotingPeriodStartDate(), ethers.provider);
      });

      it('skipped to the target time', async function () {
        assertDatesAreClose(
          await getTime(ethers.provider),
          await ElectionModule.getVotingPeriodStartDate()
        );
      });

      it('shows that the current period is Vote', async function () {
        assertBn.eq(await ElectionModule.getCurrentPeriodType(), ElectionPeriod.Vote);
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
        await fastForwardTo(await ElectionModule.getEpochEndDate(), ethers.provider);
      });

      it('skipped to the target time', async function () {
        assertDatesAreClose(await getTime(ethers.provider), await ElectionModule.getEpochEndDate());
      });

      it('shows that the current period is Evaluation', async function () {
        assertBn.eq(await ElectionModule.getCurrentPeriodType(), ElectionPeriod.Evaluation);
      });

      itRejectsNominations();
      itRejectsVotes();
      itRejectsAdjustments();
      itAcceptsEvaluations();
    });
  });
});
