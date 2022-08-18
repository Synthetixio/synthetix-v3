const { ethers } = hre;
const assert = require('assert/strict');
const { default: assertRevert } = require('@synthetixio/core-js/dist/utils/assertions/assert-revert');
const { bootstrap } = require('@synthetixio/hardhat-router/utils/tests');
const initializer = require('@synthetixio/core-modules/test/helpers/initializer');

describe('UpgradeModule', () => {
  const { proxyAddress } = bootstrap(initializer, { modules: '.*(Owner|Upgrade).*' });

  let UpgradeModule;
  let owner, user;

  before('identify signers', async () => {
    [owner, user] = await ethers.getSigners();
  });

  before('deploy the module mocking the first owner', async () => {
    UpgradeModule = await ethers.getContractAt('UpgradeModule', proxyAddress());
  });

  describe('when attempting to set the implementation with a non owner signer', () => {
    it('reverts', async () => {
      await assertRevert(UpgradeModule.connect(user).upgradeTo(user.address), 'Unauthorized');
    });
  });

  describe('when upgrading the implementation', () => {
    let NewRouter;

    before('set a new implementation using the owner address', async () => {
      const factory = await ethers.getContractFactory('Router');
      NewRouter = await factory.deploy();

      const tx = await UpgradeModule.connect(owner).upgradeTo(NewRouter.address);
      await tx.wait();
    });

    it('shows that the implementation is set', async () => {
      assert.equal(await UpgradeModule.connect(owner).getImplementation(), NewRouter.address);
    });
  });
});
