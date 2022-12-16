import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assert from 'assert/strict';
import { ethers } from 'ethers';
import hre from 'hardhat';
import { UpgradeModule } from '../../../typechain-types';
import { bootstrap } from '../../bootstrap.js';

describe('UpgradeModule', function () {
  const { getContract, getSigners } = bootstrap();

  let UpgradeModule: UpgradeModule;
  let owner: ethers.Signer;
  let user: ethers.Signer;

  before('initialize', function () {
    [owner, user] = getSigners();
    UpgradeModule = getContract('UpgradeModule') as UpgradeModule;
  });

  before('deploy the module mocking the first owner', async function () {});

  describe('when attempting to set the implementation with a non owner signer', async function () {
    it('reverts', async function () {
      await assertRevert(
        UpgradeModule.connect(user).upgradeTo(await user.getAddress()),
        'Unauthorized'
      );
    });
  });

  describe('when upgrading the implementation', function () {
    let NewRouter: ethers.Contract;

    before('set a new implementation using the owner address', async function () {
      const factory = await hre.ethers.getContractFactory('Router');
      NewRouter = await factory.deploy();

      const tx = await UpgradeModule.connect(owner).upgradeTo(NewRouter.address);
      await tx.wait();
    });

    it('shows that the implementation is set', async function () {
      assert.equal(await UpgradeModule.connect(owner).getImplementation(), NewRouter.address);
    });
  });
});
