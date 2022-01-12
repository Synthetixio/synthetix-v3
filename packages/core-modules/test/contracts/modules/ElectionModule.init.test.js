const { ethers } = hre;
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { getUnixTimestamp, daysToSeconds } = require('@synthetixio/core-js/utils/misc/dates');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');

describe('ElectionModule (init)', () => {
  const { proxyAddress } = bootstrap(initializer);

  let ElectionModule;

  let owner, user;

  let epochEndDate, nominationPeriodStartDate, votingPeriodStartDate;

  before('identify signers', async () => {
    [owner, user] = await ethers.getSigners();
  });

  before('identify modules', async () => {
    ElectionModule = await ethers.getContractAt('ElectionModule', proxyAddress());
  });

  describe.skip('before initializing the module', function () {
    // TODO
  });

  describe('when initializing the module', function () {
    describe('with an account that does not own the instance', function () {
      before('link to non-owner', async function () {
        ElectionModule = ElectionModule.connect(user);
      });

      it('reverts', async function () {
        await assertRevert(ElectionModule.initializeElectionModule(0, 0, 0), 'Unauthorized');
      });
    });

    describe('with the account that owns the instance', function () {
      before('link to owner', async function () {
        ElectionModule = ElectionModule.connect(owner);
      });

      describe('with invalid parameters', function () {
        describe('with any zero date', function () {
          it('reverts', async function () {
            await assertRevert(
              ElectionModule.initializeElectionModule(0, 1, 1),
              'InvalidEpochConfiguration'
            );
            await assertRevert(
              ElectionModule.initializeElectionModule(1, 0, 1),
              'InvalidEpochConfiguration'
            );
            await assertRevert(
              ElectionModule.initializeElectionModule(1, 1, 0),
              'InvalidEpochConfiguration'
            );
          });
        });

        describe('with any short duration', function () {
          it('reverts', async function () {
            const now = getUnixTimestamp();

            epochEndDate = now + daysToSeconds(4);
            votingPeriodStartDate = epochEndDate - daysToSeconds(7);
            nominationPeriodStartDate = votingPeriodStartDate - daysToSeconds(7);
            await assertRevert(
              ElectionModule.initializeElectionModule(
                epochEndDate,
                nominationPeriodStartDate,
                votingPeriodStartDate
              ),
              'InvalidEpochConfiguration'
            );

            epochEndDate = now + daysToSeconds(90);
            votingPeriodStartDate = epochEndDate - daysToSeconds(0.5);
            nominationPeriodStartDate = votingPeriodStartDate - daysToSeconds(7);
            await assertRevert(
              ElectionModule.initializeElectionModule(
                epochEndDate,
                nominationPeriodStartDate,
                votingPeriodStartDate
              ),
              'InvalidEpochConfiguration'
            );

            epochEndDate = now + daysToSeconds(90);
            votingPeriodStartDate = epochEndDate - daysToSeconds(7);
            nominationPeriodStartDate = votingPeriodStartDate - daysToSeconds(0.5);
            await assertRevert(
              ElectionModule.initializeElectionModule(
                epochEndDate,
                nominationPeriodStartDate,
                votingPeriodStartDate
              ),
              'InvalidEpochConfiguration'
            );
          });
        });
      });

      describe('with valid parameters', function () {
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

        it('shows that the current epoch index is 1', async function () {
          assertBn.eq(await ElectionModule.getEpochIndex(), 1);
        });

        it('shows that the first epoch has appropriate parameters', async function () {
          assertBn.eq(await ElectionModule.getEpochEndDate(), epochEndDate);
          assertBn.eq(
            await ElectionModule.getNominationPeriodStartDate(),
            nominationPeriodStartDate
          );
          assertBn.eq(await ElectionModule.getVotingPeriodStartDate(), votingPeriodStartDate);
        });

        describe('when attemting to re-initialize the module', function () {
          it('reverts', async function () {
            await assertRevert(
              ElectionModule.initializeElectionModule(0, 0, 0),
              'AlreadyInitialized'
            );
          });
        });
      });
    });
  });
});
