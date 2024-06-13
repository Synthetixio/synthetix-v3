import assert from 'node:assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { daysToSeconds } from '@synthetixio/core-utils/utils/misc/dates';
import { ethers } from 'ethers';
import { bootstrap } from '../../bootstrap';
import { ElectionPeriod } from '../../constants';
import { GovernanceProxy } from '../../generated/typechain';

describe('ElectionModule - Initialization', function () {
  const { c, getSigners, getProvider, deployNewProxy } = bootstrap();

  let owner: ethers.Signer;
  let user: ethers.Signer;

  let ElectionModule: GovernanceProxy;

  async function _initOrUpdateElectionSettings({
    caller = owner,
    minimumActiveMembers = 1,
    initialNominationPeriodStartDate = 0,
    administrationPeriodDuration = 14,
    nominationPeriodDuration = 7,
    votingPeriodDuration = 7,
  } = {}) {
    return ElectionModule.connect(caller).initOrUpdateElectionSettings(
      [await caller.getAddress()],
      '0x28D8F1Be96f97C1387e94A53e00eCcFb4E75175a', // addresses are not important
      '0x28D8F1Be96f97C1387e94A53e00eCcFb4E75175a',
      minimumActiveMembers,
      initialNominationPeriodStartDate,
      administrationPeriodDuration,
      nominationPeriodDuration,
      votingPeriodDuration
    );
  }

  before('identify signers', function () {
    [owner, user] = getSigners();
  });

  before('register emitters', async function () {
    await c.GovernanceProxy.connect(owner).setRegisteredEmitters(
      [13370],
      [c.GovernanceProxy.address]
    );
  });

  before('deploy uninitialized module', async function () {
    ElectionModule = await deployNewProxy();

    await ElectionModule.initOrUpgradeNft(
      ethers.utils.formatBytes32String('councilToken'),
      await c.CouncilToken.name(),
      await c.CouncilToken.symbol(),
      'https://synthetix.io',
      await c.CouncilToken.getImplementation()
    );
  });

  describe('before initializing the module', function () {
    it('shows that the module is not initialized', async function () {
      assert.equal(await ElectionModule.isElectionModuleInitialized(), false);
    });
  });

  describe('when initializing the module', function () {
    describe('with an account that does not own the instance', function () {
      it('reverts', async function () {
        await assertRevert(_initOrUpdateElectionSettings({ caller: user }), 'Unauthorized');
      });
    });

    describe('with the account that owns the instance', function () {
      describe('with invalid parameters', function () {
        describe('with invalid minimumActiveMembers', function () {
          it('reverts using 0', async function () {
            await assertRevert(
              _initOrUpdateElectionSettings({ minimumActiveMembers: 0 }),
              'InvalidElectionSettings'
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

          const administrationPeriodDuration = 14;
          const nominationPeriodDuration = 7;
          const votingPeriodDuration = 7;

          const epochDuration =
            administrationPeriodDuration + nominationPeriodDuration + votingPeriodDuration;

          epochEndDate = epochStartDate + daysToSeconds(epochDuration);
          nominationPeriodStartDate =
            epochEndDate - daysToSeconds(votingPeriodDuration + nominationPeriodDuration);
          votingPeriodStartDate = epochEndDate - daysToSeconds(votingPeriodDuration);

          const initialNominationPeriodStartDate =
            epochStartDate + daysToSeconds(administrationPeriodDuration);

          const tx = await _initOrUpdateElectionSettings({
            minimumActiveMembers: 1,
            initialNominationPeriodStartDate,
            administrationPeriodDuration,
            nominationPeriodDuration,
            votingPeriodDuration,
          });

          rx = await tx.wait();
        });

        it('shows that the current period is Administration', async function () {
          assertBn.equal(await ElectionModule.getCurrentPeriod(), ElectionPeriod.Administration);
        });

        it('shows that the current epoch index is 0', async function () {
          assertBn.equal(await ElectionModule.getEpochIndex(), 0);
        });

        it('returns the current schedule', async function () {
          const schedule = await ElectionModule.connect(user).getEpochSchedule();
          assertBn.near(schedule.startDate, epochStartDate, 2);
          assertBn.near(schedule.endDate, epochEndDate, 2);
          assertBn.near(schedule.nominationPeriodStartDate, nominationPeriodStartDate, 2);
          assertBn.near(schedule.votingPeriodStartDate, votingPeriodStartDate, 2);
        });

        it('emitted a ElectionModuleInitialized event', async function () {
          await assertEvent(rx, 'ElectionModuleInitialized', c.GovernanceProxy);
        });

        it('emitted a EpochStarted event', async function () {
          await assertEvent(rx, 'EpochStarted(0)', c.GovernanceProxy);
        });
      });
    });
  });
});
