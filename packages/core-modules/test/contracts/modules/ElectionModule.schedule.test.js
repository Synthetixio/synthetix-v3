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
        await assertRevert(ElectionModule.evaluate(), 'NotCallableInCurrentPeriod');
      });
    });

    describe('when trying to call the resolve function', function () {
      it('reverts', async function () {
        await assertRevert(ElectionModule.evaluate(), 'NotCallableInCurrentPeriod');
      });
    });
  };

  const itAcceptsEvaluations = () => {
    describe('when trying to call the evaluate function', function () {
      it('does not revert', async function () {
        await ElectionModule.evaluate();
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
    describe('when trying to call the adjustEpoch function', function () {
      it('reverts', async function () {
        await assertRevert(ElectionModule.adjustEpoch(0, 0, 0), 'NotCallableInCurrentPeriod');
      });
    });
  };

  const itAcceptsAdjustments = () => {
    describe('when trying to call the adjustEpoch function', function () {
      describe('with invalid parameters', function () {
        describe('with zero dates', function () {
          it('reverts', async function () {
            await assertRevert(ElectionModule.adjustEpoch(0, 0, 0), 'InvalidEpochConfiguration');
          });
        });

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
              ElectionModule.adjustEpoch(
                epochEndDate + daysToSeconds(8),
                nominationPeriodStartDate + daysToSeconds(2),
                votingPeriodStartDate + daysToSeconds(2)
              ),
              'InvalidEpochConfiguration'
            );
            await assertRevert(
              ElectionModule.adjustEpoch(
                epochEndDate + daysToSeconds(7),
                nominationPeriodStartDate - daysToSeconds(3),
                votingPeriodStartDate + daysToSeconds(2)
              ),
              'InvalidEpochConfiguration'
            );
            await assertRevert(
              ElectionModule.adjustEpoch(
                epochEndDate + daysToSeconds(7),
                nominationPeriodStartDate + daysToSeconds(2),
                votingPeriodStartDate - daysToSeconds(3)
              ),
              'InvalidEpochConfiguration'
            );
          });
        });
      });

      describe('with valid parameters', function () {
        let newEpochDuration,
          newEpochEndDate,
          newNominationPeriodStartDate,
          newVotingPeriodStartDate;

        before('take snapshot', async function () {
          snapshotId = await takeSnapshot(ethers.provider);
        });

        after('restore snapshot', async function () {
          await restoreSnapshot(snapshotId, ethers.provider);
        });

        before('adjust', async function () {
          newEpochEndDate = (await ElectionModule.getEpochEndDate()).toNumber() + daysToSeconds(4);
          newEpochDuration =
            newEpochEndDate - (await ElectionModule.getEpochStartDate()).toNumber();
          newNominationPeriodStartDate =
            (await ElectionModule.getNominationPeriodStartDate()).toNumber() - daysToSeconds(2);
          newVotingPeriodStartDate =
            (await ElectionModule.getVotingPeriodStartDate()).toNumber() + daysToSeconds(0.5);

          await ElectionModule.adjustEpoch(
            newEpochEndDate,
            newNominationPeriodStartDate,
            newVotingPeriodStartDate
          );
        });

        it('properly adjusted dates', async function () {
          assertDatesAreClose(await ElectionModule.getEpochEndDate(), newEpochEndDate);
          assertDatesAreClose(
            await ElectionModule.getNominationPeriodStartDate(),
            newNominationPeriodStartDate
          );
          assertDatesAreClose(
            await ElectionModule.getVotingPeriodStartDate(),
            newVotingPeriodStartDate
          );
        });

        it('properly adjusted durations', async function () {
          assertBn.eq(await ElectionModule.getEpochDuration(), newEpochDuration);
        });
      });
    });
  };

  // ----------------------------------
  // Idle period
  // ----------------------------------

  describe('when the module is initialized', function () {
    before('initialize', async function () {
      await ElectionModule.initializeElectionModule(
        daysToSeconds(90),
        daysToSeconds(7),
        daysToSeconds(7)
      );
    });

    it('shows that initial period is Idle', async function () {
      assertBn.eq(await ElectionModule.getCurrentPeriodType(), ElectionPeriod.Idle);
    });

    describe('when an account that does not own the instance attempts to adjust the epoch', function () {
      it('reverts', async function () {
        await assertRevert(ElectionModule.connect(user).adjustEpoch(0, 0, 0), 'Unauthorized');
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
