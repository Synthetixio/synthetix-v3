import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assert from 'assert/strict';
import { ethers } from 'ethers';
import hre from 'hardhat';
import { UpgradeModule } from '../../../typechain-types';
import { bootstrap } from '../../bootstrap';

describe('UpgradeModule', function () {
  const { getContract, getSigners } = bootstrap({ implementation: 'CoreRouter' });

  let UpgradeModule: UpgradeModule;
  let user: ethers.Signer;

  before('initialize', async function () {
    [, user] = getSigners();
    UpgradeModule = getContract('UpgradeModule');
  });

  describe('when attempting to set the implementation with a non owner signer', async function () {
    it('reverts', async function () {
      await assertRevert(
        UpgradeModule.connect(user).upgradeTo(await user.getAddress()),
        'Unauthorized'
      );
    });
  });

  describe('when upgrading the implementation', function () {
    let NewImplementation: ethers.Contract;

    before('initialize new Router', async function () {
      const factory = await hre.ethers.getContractFactory('Router');
      NewImplementation = await factory.deploy();
    });

    before('set a new implementation using the owner address', async function () {
      const tx = await UpgradeModule.upgradeTo(NewImplementation.address);
      await tx.wait();
    });

    it('sets a new implementation using the owner address', async function () {
      assert.equal(await UpgradeModule.getImplementation(), NewImplementation.address);
    });
  });
});
