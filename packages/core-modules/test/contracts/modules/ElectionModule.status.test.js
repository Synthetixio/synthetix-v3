const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { getTime, fastForwardTo } = require('@synthetixio/core-js/utils/hardhat/rpc');
const { getUnixTimestamp } = require('@synthetixio/core-js/utils/misc/get-date');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');

describe('ElectionModule (status)', () => {
  const { proxyAddress } = bootstrap(initializer);

  let ElectionModule;

  let user;

  let epochEndDate, nominationPeriodStartDate, votingPeriodStartDate, someDate;

  const daysToSeconds = (days) => days * 3600 * 24;

  const EpochStatus = {
    Idle: 0,
    Nominating: 1,
    Voting: 2,
    Evaluating: 3,
  };

  // ----------------------------------
  // Nomination behavior
  // ----------------------------------

  const itRejectsNominations = () => {
    describe('when trying to call the nominate function', function () {
      it('reverts', async function () {
        await assertRevert(ElectionModule.nominate(), 'OnlyCallableWhileNominating');
      });
    });

    describe('when trying to call the withdrawNomination function', function () {
      it('reverts', async function () {
        await assertRevert(ElectionModule.nominate(), 'OnlyCallableWhileNominating');
      });
    });
  };

  const itAcceptsNominations = () => {
    before('link to user', async function () {
      ElectionModule = ElectionModule.connect(user);
    });

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
        await assertRevert(ElectionModule.elect([user.address]), 'OnlyCallableWhileVoting');
      });
    });
  };

  const itAcceptsVotes = () => {
    before('link to user', async function () {
      ElectionModule = ElectionModule.connect(user);
    });

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
        await assertRevert(ElectionModule.evaluate(), 'OnlyCallableWhileEvaluating');
      });
    });

    describe('when trying to call the resolve function', function () {
      it('reverts', async function () {
        await assertRevert(ElectionModule.evaluate(), 'OnlyCallableWhileEvaluating');
      });
    });
  };

  const itAcceptsEvaluations = () => {
    before('link to user', async function () {
      ElectionModule = ElectionModule.connect(user);
    });

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
  // Idle period
  // ----------------------------------

  before('identify signers', async () => {
    [user] = await ethers.getSigners();
  });

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

    it('shows that initial status is Idle', async function () {
      assertBn.eq(await ElectionModule.getEpochStatus(), EpochStatus.Idle);
    });

    describe('while in the Idle period', function () {
      itRejectsNominations();
      itRejectsVotes();
      itRejectsEvaluations();
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
      itAcceptsEvaluations();

      describe('when fast forwarding more', function () {
        before('fast forward', async function () {
          someDate = epochEndDate + 1000;

          await fastForwardTo(someDate, ethers.provider);
        });

        it('skipped to the target time', async function () {
          assert.equal(await getTime(ethers.provider), someDate);
        });

        it('shows that the current status is still Evaluating', async function () {
          assertBn.eq(await ElectionModule.getEpochStatus(), EpochStatus.Evaluating);
        });

        itRejectsNominations();
        itRejectsVotes();
        itAcceptsEvaluations();
      });
    });
  });
});
