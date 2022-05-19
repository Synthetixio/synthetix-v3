const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { daysToSeconds } = require('@synthetixio/core-js/utils/misc/dates');
const { getTime } = require('@synthetixio/core-js/utils/hardhat/rpc');
const { ElectionPeriod, assertDatesAreClose } = require('../helpers/election-helper');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');

module.exports = function(getElectionModule) {
  let ElectionModule;

  let owner, user;

  let epochEndDate, nominationPeriodStartDate, votingPeriodStartDate;

  before('identify signers', async () => {
    [owner, user] = await ethers.getSigners();
  });

  before('retrieve the election module', async function () {
    ElectionModule = await getElectionModule();
  });

  describe('when trying to initialize the module', function () {
    describe('with an account that does not own the instance', function () {
      it('reverts', async function () {
        await assertRevert(
          ElectionModule.connect(user).initializeElectionModule('', '', [], 0, 0, 0, 0),
          'Unauthorized'
        );
      });
    });

    describe('with the account that owns the instance', function () {
      describe('with invalid parameters', function () {
        describe('with invalid minimumActiveMembers', function () {
          it('reverts', async function () {
            await assertRevert(
              ElectionModule.connect(owner).initializeElectionModule(
                '',
                '',
                [owner.address],
                2,
                0,
                0,
                0
              ),
              'InvalidMinimumActiveMembers'
            );
            await assertRevert(
              ElectionModule.connect(owner).initializeElectionModule(
                '',
                '',
                [owner.address],
                0,
                0,
                0,
                0
              ),
              'InvalidMinimumActiveMembers'
            );
          });
        });

        describe('with incorrect date order', function () {
          it('reverts', async function () {
            const now = await getTime(ethers.provider);
            const date1 = now + daysToSeconds(7);
            const date2 = date1 + daysToSeconds(2);
            const date3 = date2 + daysToSeconds(2);

            await assertRevert(
              ElectionModule.connect(owner).initializeElectionModule(
                '',
                '',
                [owner.address],
                1,
                date2,
                date1,
                date3
              ),
              'InvalidEpochConfiguration'
            );
            await assertRevert(
              ElectionModule.initializeElectionModule(
                '',
                '',
                [owner.address],
                1,
                date1,
                date3,
                date2
              ),
              'InvalidEpochConfiguration'
            );
            await assertRevert(
              ElectionModule.initializeElectionModule(
                '',
                '',
                [owner.address],
                1,
                date3,
                date2,
                date1
              ),
              'InvalidEpochConfiguration'
            );
          });
        });

        describe('with any short duration', function () {
          it('reverts', async function () {
            const now = await getTime(ethers.provider);

            epochEndDate = now + daysToSeconds(4);
            votingPeriodStartDate = epochEndDate - daysToSeconds(2);
            nominationPeriodStartDate = votingPeriodStartDate - daysToSeconds(2);
            await assertRevert(
              ElectionModule.connect(owner).initializeElectionModule(
                '',
                '',
                [owner.address],
                1,
                nominationPeriodStartDate,
                votingPeriodStartDate,
                epochEndDate
              ),
              'InvalidEpochConfiguration'
            );

            epochEndDate = now + daysToSeconds(7);
            votingPeriodStartDate = epochEndDate - daysToSeconds(1);
            nominationPeriodStartDate = votingPeriodStartDate - daysToSeconds(2);
            await assertRevert(
              ElectionModule.connect(owner).initializeElectionModule(
                '',
                '',
                [owner.address],
                1,
                nominationPeriodStartDate,
                votingPeriodStartDate,
                epochEndDate
              ),
              'InvalidEpochConfiguration'
            );

            epochEndDate = now + daysToSeconds(7);
            votingPeriodStartDate = epochEndDate - daysToSeconds(2);
            nominationPeriodStartDate = votingPeriodStartDate - daysToSeconds(1);
            await assertRevert(
              ElectionModule.connect(owner).initializeElectionModule(
                '',
                '',
                [owner.address],
                1,
                now + daysToSeconds(1),
                now + daysToSeconds(2),
                now + daysToSeconds(7)
              ),
              'InvalidEpochConfiguration'
            );
          });
        });
      });
    });
  });
}
