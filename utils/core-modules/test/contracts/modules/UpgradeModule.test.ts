import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assert from 'assert/strict';
import { ethers } from 'ethers';
import { CoreRouter__factory, UpgradeModule } from '../../../typechain-types';
import { bootstrap } from '../../bootstrap';

describe('UpgradeModule', function () {
  const { getContractBehindProxy, getSigners } = bootstrap({
    implementation: 'CoreRouter',
  });

  let UpgradeModule: UpgradeModule;
  let owner: ethers.Signer;
  let user: ethers.Signer;

  before('initialize', async function () {
    [owner, user] = getSigners();
    UpgradeModule = getContractBehindProxy('UpgradeModule');
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
      const factory = new CoreRouter__factory(owner);
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
