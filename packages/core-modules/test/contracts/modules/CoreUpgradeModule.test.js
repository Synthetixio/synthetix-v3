const { ethers } = hre;
const assert = require('assert/strict');
const assertRevert = require('@synthetixio/core-js/utils/assert-revert');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');

describe('CoreUpgradeModule', () => {
  const { proxyAddress } = bootstrap(initializer);

  let CoreUpgradeModule;
  let owner, user;

  before('identify signers', async () => {
    [owner, user] = await ethers.getSigners();
  });

  before('deploy the module mocking the first owner', async () => {
    CoreUpgradeModule = await ethers.getContractAt('CoreUpgradeModule', proxyAddress());
  });

  describe('when attempting to set the implementation with a non owner signer', () => {
    it('reverts', async () => {
      await assertRevert(
        CoreUpgradeModule.connect(user).upgradeTo(user.address),
        'OnlyOwnerAllowed()'
      );
    });
  });

  describe('when upgrading the implementation', () => {
    let NewRouter;

    before('set a new implementation using the owner address', async () => {
      const factory = await ethers.getContractFactory('Router');
      NewRouter = await factory.deploy();

      const tx = await CoreUpgradeModule.connect(owner).upgradeTo(NewRouter.address);
      await tx.wait();
    });

    it('shows that the implementation is set', async () => {
      assert.equal(await CoreUpgradeModule.connect(owner).getImplementation(), NewRouter.address);
    });
  });
});
