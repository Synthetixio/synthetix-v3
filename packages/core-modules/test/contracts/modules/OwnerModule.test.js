const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/dist/utils/assertions/assert-bignumber');
const { default: assertRevert } = require('@synthetixio/core-js/dist/utils/assertions/assert-revert');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('@synthetixio/core-modules/test/helpers/initializer');

describe('OwnerModule', () => {
  const { proxyAddress } = bootstrap(initializer, { modules: '.*(Owner|Sample|Upgrade).*' });

  let OwnerModule, SampleOwnedModule;
  let owner, user;

  before('identify signers', async () => {
    [owner, user] = await ethers.getSigners();
  });

  before('identify modules', async () => {
    OwnerModule = await ethers.getContractAt(
      'contracts/modules/OwnerModule.sol:OwnerModule',
      proxyAddress()
    );
    SampleOwnedModule = await ethers.getContractAt('SampleOwnedModule', proxyAddress());
  });

  it('shows that the owner is set', async () => {
    assert.equal(await OwnerModule.owner(), owner.address);
  });

  describe('when a regular user attempts to interact with the protected function', () => {
    it('reverts', async () => {
      await assertRevert(SampleOwnedModule.connect(user).setProtectedValue(42), 'Unauthorized');
    });
  });

  describe('when the owner interacts with the protected function', () => {
    before('set value', async () => {
      await (await SampleOwnedModule.connect(owner).setProtectedValue(42)).wait();
    });

    it('sets the value', async () => {
      assertBn.equal(await SampleOwnedModule.getProtectedValue(), 42);
    });
  });
});
