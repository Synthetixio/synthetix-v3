const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { fastForwardTo } = require('@synthetixio/core-js/utils/hardhat/rpc');
const { getUnixTimestamp, daysToSeconds } = require('@synthetixio/core-js/utils/misc/dates');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');
const { ElectionPeriod } = require('../../helpers/election-helper');

describe.only('ElectionModule (vote)', () => {
  const { proxyAddress } = bootstrap(initializer);

  let ElectionModule;

  let epochEndDate, nominationPeriodStartDate, votingPeriodStartDate;

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

    describe('when entering the nomiantion period', function () {
      before('fast forward', async function () {
        await fastForwardTo(nominationPeriodStartDate, ethers.provider);
      });

      it('shows that the current period is Nomination', async function () {
        assertBn.eq(await ElectionModule.getCurrentPeriod(), ElectionPeriod.Nomination);
      });

      describe('when nominations exist', function () {
        // TODO

        describe('when entering the vote period', function () {
          before('fast forward', async function () {
            await fastForwardTo(votingPeriodStartDate, ethers.provider);
          });

          it('shows that the current period is Vote', async function () {
            assertBn.eq(await ElectionModule.getCurrentPeriod(), ElectionPeriod.Vote);
          });

          describe('when voting with zero candidates', function () {
            it('reverts', async function () {
              await assertRevert(
                ElectionModule.elect([]),
                'NoCandidates'
              );
            });
          });
        });
      });
    });
  });
});
