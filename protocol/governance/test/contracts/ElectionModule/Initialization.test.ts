import assert from 'node:assert/strict';
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
            'initOrUpgradeElectionModule(address[],uint8,uint8,uint64,uint16,uint16,address)'
          ]([await user.getAddress()], 1, 2, 0, 0, 0, c.DebtShareMock.address),
          'Unauthorized'
        );
      });
    });

    describe('with the account that owns the instance', function () {
      describe('with the wrong initializer', function () {
        it('reverts', async function () {
          await assertRevert(
            CoreProxy.connect(owner)[
              'initOrUpgradeElectionModule(address[],uint8,uint8,uint64,uint64,uint64)'
            ]([await user.getAddress()], 1, 2, 0, 0, 0),
            'WrongInitializer'
          );
        });
      });

      describe('with invalid parameters', function () {
        describe('with invalid debtShareContract', function () {
          it('reverts using Zero Address', async function () {
            await assertRevert(
              CoreProxy.connect(owner)[
                'initOrUpgradeElectionModule(address[],uint8,uint8,uint64,uint16,uint16,address)'
              ]([await owner.getAddress()], 1, 2, 0, 0, 0, ethers.constants.AddressZero),
              'ZeroAddress'
            );
          });

          it('reverts using EOD', async function () {
            await assertRevert(
              CoreProxy.connect(owner)[
                'initOrUpgradeElectionModule(address[],uint8,uint8,uint64,uint16,uint16,address)'
              ]([await owner.getAddress()], 1, 2, 0, 0, 0, await user.getAddress()),
              'NotAContract'
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
            'initOrUpgradeElectionModule(address[],uint8,uint8,uint64,uint16,uint16,address)'
          ](
            [await owner.getAddress(), await user.getAddress()],
            1,
            2,
            nominationPeriodStartDate,
            votingPeriodDuration,
            epochDuration,
            c.DebtShareMock.address
          );

          rx = await tx2.wait();
        });

        it('set the debt share contract address', async function () {
          assert.equal(await CoreProxy.getDebtShareContract(), c.DebtShareMock.address);
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
              'initOrUpgradeElectionModule(address[],uint8,uint8,uint64,uint16,uint16,address)'
            ](
              [await owner.getAddress(), await user.getAddress()],
              1,
              10, // Change nextEpochSeatCount
              0,
              7,
              60,
              c.DebtShareMock.address
            );
          });

          it('should not set new values', async function () {
            const settings = await CoreProxy.getElectionSettings();
            assertBn.equal(settings.nextEpochSeatCount, 2);
          });
        });
      });
    });
  });
});
