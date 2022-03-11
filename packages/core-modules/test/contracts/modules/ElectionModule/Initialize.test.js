const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { daysToSeconds } = require('@synthetixio/core-js/utils/misc/dates');
const { getTime } = require('@synthetixio/core-js/utils/hardhat/rpc');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../../helpers/initializer');
const { ElectionPeriod, assertDatesAreClose } = require('./helpers/election-helper');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');

describe('ElectionModule (initialization)', () => {
  const { proxyAddress } = bootstrap(initializer);

  let ElectionModule, CouncilToken;

  let owner, user;

  let epochStartDate, epochEndDate, nominationPeriodStartDate, votingPeriodStartDate;

  let receipt;

  before('identify signers', async () => {
    [owner, user] = await ethers.getSigners();
  });

  before('identify modules', async () => {
    ElectionModule = await ethers.getContractAt('ElectionModule', proxyAddress());
  });

  describe('before initializing the module', function () {
    it('shows that the module is not initialized', async () => {
      assert.equal(await ElectionModule.isElectionModuleInitialized(), false);
    });

    it('shows that the council token does not exist', async function () {
      assert.equal(
        await ElectionModule.getCouncilToken(),
        '0x0000000000000000000000000000000000000000'
      );
    });

    describe('trying to retrieve the period', function () {
      it('reverts', async function () {
        await assertRevert(ElectionModule.getCurrentPeriod(), 'InvalidEpochConfiguration');
      });
    });
  });

  describe('when initializing the module', function () {
    describe('with an account that does not own the instance', function () {
      it('reverts', async function () {
        await assertRevert(
          ElectionModule.connect(user).initializeElectionModule('', '', [], 0, 0, 0),
          'Unauthorized'
        );
      });
    });

    describe('with the account that owns the instance', function () {
      describe('with invalid parameters', function () {
        describe('with incorrect date order', function () {
          it('reverts', async function () {
            const now = await getTime(ethers.provider);
            const date1 = now + daysToSeconds(2);
            const date2 = date1 + daysToSeconds(2);
            const date3 = date2 + daysToSeconds(2);

            await assertRevert(
              ElectionModule.connect(owner).initializeElectionModule(
                '',
                '',
                [],
                date2,
                date1,
                date3
              ),
              'InvalidEpochConfiguration'
            );
            await assertRevert(
              ElectionModule.initializeElectionModule('', '', [], date1, date3, date2),
              'InvalidEpochConfiguration'
            );
            await assertRevert(
              ElectionModule.initializeElectionModule('', '', [], date3, date2, date1),
              'InvalidEpochConfiguration'
            );
            await assertRevert(
              ElectionModule.initializeElectionModule('', '', [], date1, date2, date3),
              'EmptyArray'
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
                [],
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
                [],
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
                [],
                now + daysToSeconds(1),
                now + daysToSeconds(2),
                now + daysToSeconds(7)
              ),
              'InvalidEpochConfiguration'
            );
          });
        });
      });

      describe('with valid parameters', function () {
        before('initialize', async function () {
          epochStartDate = await getTime(ethers.provider);
          epochEndDate = epochStartDate + daysToSeconds(90);
          votingPeriodStartDate = epochEndDate - daysToSeconds(7);
          nominationPeriodStartDate = votingPeriodStartDate - daysToSeconds(7);

          const tx = await ElectionModule.initializeElectionModule(
            'Spartan Council Token',
            'SCT',
            [owner.address, user.address],
            nominationPeriodStartDate,
            votingPeriodStartDate,
            epochEndDate
          );
          receipt = await tx.wait();
        });

        before('identify the council token', async function () {
          const tokenAddress = await ElectionModule.getCouncilToken();

          CouncilToken = await ethers.getContractAt('CouncilToken', tokenAddress);
        });

        it('produced a token with the correct name and symbol', async function () {
          assert.equal(await CouncilToken.name(), 'Spartan Council Token');
          assert.equal(await CouncilToken.symbol(), 'SCT');
        });

        it('emitted an ElectionModuleInitialized event', async function () {
          const event = findEvent({ receipt, eventName: 'ElectionModuleInitialized' });

          assert.ok(event);
        });

        it('emitted an EpochStarted event', async function () {
          const event = findEvent({ receipt, eventName: 'EpochStarted' });

          assert.ok(event);
          assertBn.equal(event.args.epochIndex, 1);
        });

        it('shows that the module is initialized', async () => {
          assert.equal(await ElectionModule.isElectionModuleInitialized(), true);
        });

        it('shows that the current epoch index is 1', async function () {
          assertBn.equal(await ElectionModule.getEpochIndex(), 1);
        });

        it('shows that the current period is Idle', async () => {
          assertBn.equal(await ElectionModule.getCurrentPeriod(), ElectionPeriod.Idle);
        });

        it('shows that there are two council members', async function () {
          assert.deepEqual(await ElectionModule.getCouncilMembers(), [owner.address, user.address]);
        });

        it('shows that there are two council NFTs', async function () {
          assertBn.equal(await CouncilToken.balanceOf(owner.address), 1);
          assertBn.equal(await CouncilToken.balanceOf(user.address), 1);
        });

        it('reflects the expected default settings', async function () {
          assertBn.equal(await ElectionModule.getNextEpochSeatCount(), 2);
          assertBn.equal(await ElectionModule.getMinimumActiveMembers(), 2);
        });

        it('shows that the first epoch has appropriate dates', async function () {
          assertDatesAreClose(await ElectionModule.getEpochStartDate(), epochStartDate);
          assertDatesAreClose(
            await ElectionModule.getVotingPeriodStartDate(),
            votingPeriodStartDate
          );
          assertDatesAreClose(
            await ElectionModule.getNominationPeriodStartDate(),
            nominationPeriodStartDate
          );
          assertDatesAreClose(await ElectionModule.getEpochEndDate(), epochEndDate);
        });

        it('shows that the council token was created', async function () {
          assert.notEqual(
            await ElectionModule.getCouncilToken(),
            '0x0000000000000000000000000000000000000000'
          );
        });

        describe('when attemting to re-initialize the module', function () {
          it('reverts', async function () {
            await assertRevert(
              ElectionModule.initializeElectionModule('', '', [], 0, 0, 0),
              'AlreadyInitialized'
            );
          });
        });
      });
    });
  });
});
