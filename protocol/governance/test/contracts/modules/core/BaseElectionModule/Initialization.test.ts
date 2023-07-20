import assert from 'node:assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { daysToSeconds } from '@synthetixio/core-utils/utils/misc/dates';
import { ethers } from 'ethers';
import { bootstrap } from '../../../../bootstrap';
import { ElectionPeriod } from '../../../../constants';
import { BaseElectionModule } from '../../../../generated/typechain';

describe('BaseElectionModule - Initialization', function () {
  const { c, getSigners, getProvider } = bootstrap();

  let owner: ethers.Signer;
  let user: ethers.Signer;

  let BaseElectionModule: BaseElectionModule;

  const epochDuration = 90;
  const votingPeriodDuration = 7;

  async function _initOrUpgradeElectionModule({
    caller = owner,
    minimumActiveMembers = 1,
    nextEpochSeatCount = 2,
    nominationPeriodStartDate = 0,
    votingPeriodStartDate = 0,
    epochEndDate = 0,
  } = {}) {
    const now = await getTime(getProvider());

    if (nominationPeriodStartDate === 0) {
      nominationPeriodStartDate =
        now + daysToSeconds(epochDuration) - daysToSeconds(votingPeriodDuration) * 2;
    }

    if (votingPeriodStartDate === 0) {
      votingPeriodStartDate =
        now + daysToSeconds(epochDuration) - daysToSeconds(votingPeriodDuration);
    }

    if (epochEndDate === 0) {
      epochEndDate = now + daysToSeconds(epochDuration);
    }

    return BaseElectionModule.connect(caller).initOrUpgradeElectionModule(
      [await caller.getAddress()],
      minimumActiveMembers,
      nextEpochSeatCount,
      nominationPeriodStartDate,
      votingPeriodStartDate,
      epochEndDate
    );
  }

  before('identify signers', function () {
    [owner, user] = getSigners();
  });

  before('deploy module', async function () {
    BaseElectionModule = c.BaseElectionProxy;
  });

  describe('before initializing the module', function () {
    it('shows that the module is not initialized', async function () {
      assert.equal(await BaseElectionModule.isElectionModuleInitialized(), false);
    });
  });

  describe('when initializing the module', function () {
    describe('with an account that does not own the instance', function () {
      it('reverts', async function () {
        await assertRevert(_initOrUpgradeElectionModule({ caller: user }), 'Unauthorized');
      });
    });

    describe('with the account that owns the instance', function () {
      describe('with invalid parameters', function () {
        describe('with invalid minimumActiveMembers', function () {
          it('reverts using 0', async function () {
            await assertRevert(
              _initOrUpgradeElectionModule({ minimumActiveMembers: 0 }),
              'InvalidMinimumActiveMembers'
            );
          });

          it('reverts using more than nextEpochSeatCount', async function () {
            await assertRevert(
              _initOrUpgradeElectionModule({ minimumActiveMembers: 3, nextEpochSeatCount: 2 }),
              'InvalidMinimumActiveMembers'
            );
          });
        });
      });

      describe('with valid parameters', function () {
        let rx: ethers.ContractReceipt;

        let epochStartDate: number;
        let nominationPeriodStartDate: number;
        let epochEndDate: number;
        let votingPeriodStartDate: number;

        before('initialize', async function () {
          epochStartDate = await getTime(getProvider());
          epochEndDate = epochStartDate + daysToSeconds(epochDuration);
          nominationPeriodStartDate = epochEndDate - daysToSeconds(votingPeriodDuration) * 2;
          votingPeriodStartDate = epochEndDate - daysToSeconds(votingPeriodDuration);

          const tx = await _initOrUpgradeElectionModule({
            minimumActiveMembers: 1,
            nextEpochSeatCount: 2,
            nominationPeriodStartDate,
            votingPeriodStartDate,
            epochEndDate,
          });

          rx = await tx.wait();
        });

        it('shows that the current period is Administration', async function () {
          assertBn.equal(
            await BaseElectionModule.getCurrentPeriod(),
            ElectionPeriod.Administration
          );
        });

        it('shows that the current epoch index is 0', async function () {
          assertBn.equal(await BaseElectionModule.getEpochIndex(), 0);
        });

        it('shows that the schedule is correctly calculated', async function () {
          assertBn.near(await BaseElectionModule.getEpochStartDate(), epochStartDate, 2);
          assertBn.near(await BaseElectionModule.getEpochEndDate(), epochEndDate, 2);
          assertBn.near(
            await BaseElectionModule.getNominationPeriodStartDate(),
            nominationPeriodStartDate,
            2
          );
          assertBn.near(
            await BaseElectionModule.getVotingPeriodStartDate(),
            votingPeriodStartDate,
            2
          );
        });

        it('emitted a ElectionModuleInitialized event', async function () {
          await assertEvent(rx, 'ElectionModuleInitialized', c.CoreProxy);
        });

        it('emitted a EpochStarted event', async function () {
          await assertEvent(rx, 'EpochStarted(0)', c.CoreProxy);
        });

        describe('when called for a second time', function () {
          it('reverts', async function () {
            await assertRevert(_initOrUpgradeElectionModule(), 'AlreadyInitialized');
          });
        });
      });
    });
  });
});
