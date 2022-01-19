const { ethers } = hre;
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { daysToSeconds } = require('@synthetixio/core-js/utils/misc/dates');
const { getTime } = require('@synthetixio/core-js/utils/hardhat/rpc');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const { assertDatesAreClose } = require('../../helpers/election-helper');
const initializer = require('../../helpers/initializer');

describe('ElectionModule (init)', () => {
  const { proxyAddress } = bootstrap(initializer);

  let ElectionModule;

  let owner, user;

  let epochStartDate, epochDuration, nominationPeriodDuration, votingPeriodDuration;

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
      it('reverts', async function () {
        await assertRevert(
          ElectionModule.connect(user).initializeElectionModule(0, 0, 0),
          'Unauthorized'
        );
      });
    });

    describe('with the account that owns the instance', function () {
      describe('with invalid parameters', function () {
        describe('with any zero date', function () {
          it('reverts', async function () {
            await assertRevert(
              ElectionModule.connect(owner).initializeElectionModule(0, 1, 1),
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
            const now = await getTime(ethers.provider);

            await assertRevert(
              ElectionModule.connect(owner).initializeElectionModule(
                daysToSeconds(4),
                daysToSeconds(2),
                daysToSeconds(2)
              ),
              'InvalidEpochConfiguration'
            );

            await assertRevert(
              ElectionModule.connect(owner).initializeElectionModule(
                daysToSeconds(7),
                daysToSeconds(1),
                daysToSeconds(2)
              ),
              'InvalidEpochConfiguration'
            );

            await assertRevert(
              ElectionModule.connect(owner).initializeElectionModule(
                daysToSeconds(7),
                daysToSeconds(2),
                daysToSeconds(1)
              ),
              'InvalidEpochConfiguration'
            );
          });
        });
      });

      describe('with valid parameters', function () {
        before('initialize', async function () {
          epochStartDate = await getTime(ethers.provider);
          epochDuration = daysToSeconds(90);
          votingPeriodDuration = daysToSeconds(7);
          nominationPeriodDuration = daysToSeconds(7);

          await ElectionModule.initializeElectionModule(
            epochDuration,
            nominationPeriodDuration,
            votingPeriodDuration
          );
        });

        it('shows that the current epoch index is 1', async function () {
          assertBn.eq(await ElectionModule.getEpochIndex(), 1);
        });

        it('shows that the first epoch has appropriate durations', async function () {
          assertBn.eq(await ElectionModule.getEpochDuration(), epochDuration);
          assertBn.eq(
            await ElectionModule.getNominationPeriodDuration(),
            nominationPeriodDuration
          );
          assertBn.eq(await ElectionModule.getVotingPeriodDuration(), votingPeriodDuration);
        });

        it('shows that the first epoch has appropriate dates', async function () {
          assertDatesAreClose(await ElectionModule.getEpochStartDate(), epochStartDate);
          assertDatesAreClose(await ElectionModule.getEpochEndDate(), epochStartDate + epochDuration);
          assertDatesAreClose(await ElectionModule.getVotingPeriodStartDate(),
            epochStartDate + epochDuration - votingPeriodDuration
          );
          assertDatesAreClose(
            await ElectionModule.getNominationPeriodStartDate(),
            epochStartDate + epochDuration - votingPeriodDuration - nominationPeriodDuration
          );
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
