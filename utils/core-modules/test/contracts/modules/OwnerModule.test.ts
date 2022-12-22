import assert from 'node:assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';
import { OwnerModule, SampleOwnedModule } from '../../../typechain-types';
import { bootstrap } from '../../bootstrap';

describe('OwnerModule', function () {
  const { getContractBehindProxy, getSigners } = bootstrap({
    implementation: 'SampleRouter',
  });

  let OwnerModule: OwnerModule;
  let SampleOwnedModule: SampleOwnedModule;
  let owner: ethers.Signer;
  let user: ethers.Signer;

  before('identify dependencies', function () {
    [owner, user] = getSigners();
    OwnerModule = getContractBehindProxy('OwnerModule');
    SampleOwnedModule = getContractBehindProxy('SampleOwnedModule');
  });

  it('shows that the owner is set', async function () {
    assert.equal(await OwnerModule.owner(), await owner.getAddress());
  });

  describe('when a regular user attempts to interact with the protected function', function () {
    it('reverts', async function () {
      await assertRevert(
        SampleOwnedModule.connect(user).setProtectedValue(42),
        `Unauthorized("${await user.getAddress()}")`
      );
    });
  });

  describe('when the owner interacts with the protected function', function () {
    before('set value', async function () {
      await (await SampleOwnedModule.setProtectedValue(42)).wait();
    });

    it('sets the value', async function () {
      assertBn.equal(await SampleOwnedModule.getProtectedValue(), 42);
    });
  });
});
