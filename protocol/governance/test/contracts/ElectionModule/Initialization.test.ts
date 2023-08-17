import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { daysToSeconds } from '@synthetixio/core-utils/utils/misc/dates';
import { ethers } from 'ethers';
import hre from 'hardhat';
import { bootstrap } from '../../bootstrap';
import { ElectionPeriod } from '../../constants';
import { CoreProxy } from '../../generated/typechain';

describe('SynthetixElectionModule - Initialization', function () {
  const { c, getSigners, getProvider, deployNewProxy } = bootstrap();

  let owner: ethers.Signer;
  let user: ethers.Signer;

  let CoreProxy: CoreProxy;

  before('identify signers', function () {
    [owner, user] = getSigners();
  });

  before('create a new uninitialized CoreProxy', async function () {
    CoreProxy = await deployNewProxy();
  });

  describe('when initializing the module', function () {
    describe('with an account that does not own the instance', function () {
      it('reverts', async function () {
        await assertRevert(
          CoreProxy.connect(user)[
            'initOrUpdateElectionSettings(address[],uint8,uint8,uint64,uint64,uint64,uint64)'
          ]([await user.getAddress()], 2, 1, 0, 0, 0, 2),
          'Unauthorized'
        );
      });
    });

    describe('with the account that owns the instance', function () {
      describe('with valid parameters', function () {
        let rx: ethers.ContractReceipt;

        let epochStartDate: number;
        let nominationPeriodStartDate: number;
        let epochEndDate: number;
        let votingPeriodStartDate: number;

        before('initialize', async function () {
          const tx1 = await CoreProxy.initOrUpgradeNft(
            hre.ethers.utils.formatBytes32String('councilToken'),
            'Synthetix Governance Token',
            'SNXGOV',
            'https://synthetix.io',
            await c.CouncilToken.getImplementation()
          );

          await tx1.wait();

          const votingPeriodDuration = 7;
          const epochDuration = 90;

          epochStartDate = await getTime(getProvider());
          epochEndDate = epochStartDate + daysToSeconds(epochDuration);
          nominationPeriodStartDate = epochEndDate - daysToSeconds(votingPeriodDuration) * 2;
          votingPeriodStartDate = epochEndDate - daysToSeconds(votingPeriodDuration);

          const tx2 = await CoreProxy[
            'initOrUpdateElectionSettings(address[],uint8,uint8,uint64,uint64,uint64,uint64)'
          ](
            [await owner.getAddress(), await user.getAddress()],
            2,
            1,
            nominationPeriodStartDate,
            votingPeriodDuration,
            epochDuration,
            2
          );

          rx = await tx2.wait();
        });

        it('shows that the current period is Administration', async function () {
          assertBn.equal(await CoreProxy.getCurrentPeriod(), ElectionPeriod.Administration);
        });

        it('shows that the current epoch index is 0', async function () {
          assertBn.equal(await CoreProxy.getEpochIndex(), 0);
        });

        it('returns the current schedule', async function () {
          const schedule = await CoreProxy.connect(user).getEpochSchedule();
          assertBn.near(schedule.startDate, epochStartDate, 2);
          assertBn.near(schedule.endDate, epochEndDate, 2);
          assertBn.near(schedule.nominationPeriodStartDate, nominationPeriodStartDate, 2);
          assertBn.near(schedule.votingPeriodStartDate, votingPeriodStartDate, 2);
        });

        it('emitted a ElectionModuleInitialized event', async function () {
          await assertEvent(rx, 'ElectionModuleInitialized', c.CoreProxy);
        });

        it('emitted a EpochStarted event', async function () {
          await assertEvent(rx, 'EpochStarted(0)', c.CoreProxy);
        });

        describe('when called for a second time', function () {
          before('initialize again', async function () {
            await CoreProxy[
              'initOrUpdateElectionSettings(address[],uint8,uint8,uint64,uint64,uint64,uint64)'
            ](
              [await owner.getAddress(), await user.getAddress()],
              10, // Change epochSeatCount
              1,
              0,
              7,
              60,
              2
            );
          });

          it('should not set new values', async function () {
            const settings = await CoreProxy.getElectionSettings();
            assertBn.equal(settings.epochSeatCount, 2);
          });
        });
      });
    });
  });
});
