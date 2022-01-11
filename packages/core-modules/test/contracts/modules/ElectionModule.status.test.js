const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const { getTime, fastForwardTo } = require('@synthetixio/core-js/utils/hardhat/rpc');
const { getUnixTimestamp } = require('@synthetixio/core-js/utils/misc/get-date');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');

describe('ElectionModule (status)', () => {
  const { proxyAddress } = bootstrap(initializer);

  let ElectionModule;

  let epochEndDate, nominationPeriodStartDate, votingPeriodStartDate, someDate;

  const daysToSeconds = (days) => days * 3600 * 24;

  const EpochStatus = {
    Idle: 0,
    Nominating: 1,
    Voting: 2,
    Evaluating: 3,
  };

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
      });
    });

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
      });
    });

    describe('when exiting the voting period', function () {
      before('fast forward', async function () {
        await fastForwardTo(epochEndDate, ethers.provider);
      });

      it('skipped to the target time', async function () {
        assert.equal(await getTime(ethers.provider), epochEndDate);
      });

      it('shows that the current status is Evaluating', async function () {
        assertBn.eq(await ElectionModule.getEpochStatus(), EpochStatus.Evaluating);
      });

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
      });
    });
  });
});
