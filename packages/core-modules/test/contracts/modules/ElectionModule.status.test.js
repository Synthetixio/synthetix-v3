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
const { getUnixTimestamp, daysToSeconds } = require('@synthetixio/core-js/utils/misc/dates');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');
const { EpochStatus } = require('../../helpers/election-helper');

describe('ElectionModule (status)', () => {
  const { proxyAddress } = bootstrap(initializer);

  let ElectionModule;

  let owner, user;

  let epochEndDate, nominationPeriodStartDate, votingPeriodStartDate, someDate;

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
        await assertRevert(ElectionModule.nominate(), 'NotCallableInCurrentStatus');
      });
    });

    describe('when trying to call the withdrawNomination function', function () {
      it('reverts', async function () {
        await assertRevert(ElectionModule.nominate(), 'NotCallableInCurrentStatus');
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
  // Voting behavior
  // ----------------------------------

  const itRejectsVotes = () => {
    describe('when trying to call the elect function', function () {
      it('reverts', async function () {
        await assertRevert(ElectionModule.elect([user.address]), 'NotCallableInCurrentStatus');
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
        await assertRevert(ElectionModule.evaluate(), 'NotCallableInCurrentStatus');
      });
    });

    describe('when trying to call the resolve function', function () {
      it('reverts', async function () {
        await assertRevert(ElectionModule.evaluate(), 'NotCallableInCurrentStatus');
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
        await assertRevert(ElectionModule.adjustEpoch(0, 0, 0), 'NotCallableInCurrentStatus');
      });
    });
  };

  const itAcceptsAdjustments = () => {
    describe('when trying to call the adjustEpoch function', function () {
      describe('with invalid parameters', function () {
        it('reverts', async function () {
          await assertRevert(ElectionModule.adjustEpoch(0, 0, 0), 'InvalidEpochConfiguration');
        });
      });

      describe('with valid parameters', function () {
        before('take snapshot', async function () {
          snapshotId = await takeSnapshot(ethers.provider);
        });

        after('restore snapshot', async function () {
          await restoreSnapshot(snapshotId, ethers.provider);
        });

        it('does not revert', async function () {
          await ElectionModule.adjustEpoch(
            epochEndDate + daysToSeconds(1),
            nominationPeriodStartDate - daysToSeconds(5),
            votingPeriodStartDate + daysToSeconds(0.5)
          );
        });
      });
    });
  };

  // ----------------------------------
  // Idle period
  // ----------------------------------

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

    it('shows that initial status is Idle', async function () {
      assertBn.eq(await ElectionModule.getEpochStatus(), EpochStatus.Idle);
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
    // Nominating period
    // ----------------------------------

    describe('when entering the nomination period', function () {
      before('fast forward', async function () {
        await fastForwardTo(nominationPeriodStartDate, ethers.provider);
      });

      it('skipped to the target time', async function () {
        assert.equal(await getTime(ethers.provider), nominationPeriodStartDate);
      });

      it('shows that the current status is Nominating', async function () {
        assertBn.eq(await ElectionModule.getEpochStatus(), EpochStatus.Nominating);
      });

      itAcceptsNominations();
      itRejectsVotes();
      itRejectsEvaluations();
      itRejectsAdjustments();

      describe('when fast forwarding within the current period', function () {
        before('fast forward', async function () {
          someDate = votingPeriodStartDate - 60;

          await fastForwardTo(someDate, ethers.provider);
        });

        it('skipped to the target time', async function () {
          assert.equal(await getTime(ethers.provider), someDate);
        });

        it('shows that the current status is still Nominating', async function () {
          assertBn.eq(await ElectionModule.getEpochStatus(), EpochStatus.Nominating);
        });

        itAcceptsNominations();
        itRejectsVotes();
        itRejectsEvaluations();
        itRejectsAdjustments();
      });
    });

    // ----------------------------------
    // Voting period
    // ----------------------------------

    describe('when entering the voting period', function () {
      before('fast forward', async function () {
        await fastForwardTo(votingPeriodStartDate, ethers.provider);
      });

      it('skipped to the target time', async function () {
        assert.equal(await getTime(ethers.provider), votingPeriodStartDate);
      });

      it('shows that the current status is Voting', async function () {
        assertBn.eq(await ElectionModule.getEpochStatus(), EpochStatus.Voting);
      });

      itRejectsNominations();
      itAcceptsVotes();
      itRejectsEvaluations();
      itRejectsAdjustments();

      describe('when fast forwarding within the current period', function () {
        before('fast forward', async function () {
          someDate = epochEndDate - 60;

          await fastForwardTo(someDate, ethers.provider);
        });

        it('skipped to the target time', async function () {
          assert.equal(await getTime(ethers.provider), someDate);
        });

        it('shows that the current status is still Voting', async function () {
          assertBn.eq(await ElectionModule.getEpochStatus(), EpochStatus.Voting);
        });

        itRejectsNominations();
        itAcceptsVotes();
        itRejectsEvaluations();
        itRejectsAdjustments();
      });
    });

    // ----------------------------------
    // Evaluation period
    // ----------------------------------

    describe('when entering the evaluation period', function () {
      before('fast forward', async function () {
        await fastForwardTo(epochEndDate, ethers.provider);
      });

      it('skipped to the target time', async function () {
        assert.equal(await getTime(ethers.provider), epochEndDate);
      });

      it('shows that the current status is Evaluating', async function () {
        assertBn.eq(await ElectionModule.getEpochStatus(), EpochStatus.Evaluating);
      });

      itRejectsNominations();
      itRejectsVotes();
      itRejectsAdjustments();
      itAcceptsEvaluations();
    });
  });
});
