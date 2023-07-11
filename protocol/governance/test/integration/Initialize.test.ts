import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { daysToSeconds } from '@synthetixio/core-utils/utils/misc/dates';
import assert from 'assert/strict';
import { ethers } from 'ethers';
import hre from 'hardhat';
import { bootstrap } from '../bootstrap';
import { CoreProxy } from '../generated/typechain';

describe('SynthetixElectionModule (initialization)', () => {
  const { c, getSigners } = bootstrap();

  let owner: ethers.Signer;
  let user: ethers.Signer;

  let CoreProxy: CoreProxy;

  before('identify signers', async () => {
    [owner, user] = getSigners();
  });

  before('create a new uninitialized CoreProxy', async () => {
    const factory = await hre.ethers.getContractFactory('Proxy', owner);
    const Proxy = await factory.deploy(c.CoreRouter.address, await owner.getAddress());
    CoreProxy = c.CoreProxy.attach(Proxy.address);
  });

  describe('before initializing the module', function () {
    it('shows that the module is not initialized', async () => {
      assert.equal(await CoreProxy.isElectionModuleInitialized(), false);
    });
  });

  describe('when initializing the module', function () {
    describe('with an account that does not own the instance', function () {
      it('reverts', async function () {
        await assertRevert(
          CoreProxy.connect(user)[
            'initOrUpgradeElectionModule(address[],uint8,uint64,uint16,uint16,address)'
          ]([await user.getAddress()], 1, 0, 0, 0, c.DebtShareMock.address),
          'Unauthorized'
        );
      });
    });

    describe('with the account that owns the instance', function () {
      describe('with the wrong initializer', function () {
        it('reverts', async function () {
          await assertRevert(
            CoreProxy.connect(owner)[
              'initOrUpgradeElectionModule(address[],uint8,uint64,uint64,uint64)'
            ]([await user.getAddress()], 1, 0, 0, 0),
            'WrongInitializer'
          );
        });
      });

      describe('with invalid parameters', function () {
        describe('with invalid debtShareContract', function () {
          it('reverts using Zero Address', async function () {
            await assertRevert(
              CoreProxy.connect(owner)[
                'initOrUpgradeElectionModule(address[],uint8,uint64,uint16,uint16,address)'
              ]([await owner.getAddress()], 1, 0, 0, 0, ethers.constants.AddressZero),
              'ZeroAddress'
            );
          });

          it('reverts using EOD', async function () {
            await assertRevert(
              CoreProxy.connect(owner)[
                'initOrUpgradeElectionModule(address[],uint8,uint64,uint16,uint16,address)'
              ]([await owner.getAddress()], 1, 0, 0, 0, await user.getAddress()),
              'NotAContract'
            );
          });
        });
      });

      describe('with valid parameters', function () {
        before('initialize', async function () {
          const tx1 = await CoreProxy.initOrUpgradeNft(
            hre.ethers.utils.formatBytes32String('councilToken'),
            'Synthetix Governance Token',
            'SNXGOV',
            'https://synthetix.io',
            c.CouncilTokenRouter.address
          );

          await tx1.wait();

          const tx2 = await CoreProxy[
            'initOrUpgradeElectionModule(address[],uint8,uint64,uint16,uint16,address)'
          ](
            [await owner.getAddress(), await user.getAddress()],
            1,
            0,
            7,
            90,
            c.DebtShareMock.address
          );

          await tx2.wait();
        });

        it('set the debt share contract address', async function () {
          assert.equal(await CoreProxy.getDebtShareContract(), c.DebtShareMock.address);
        });
      });
    });
  });
});
