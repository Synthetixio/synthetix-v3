const assert = require('assert/strict');
const { getProxyAddress, getRouterAddress } = require('@synthetixio/deployer/utils/deployments');
const assertRevert = require('@synthetixio/core-js/utils/assert-revert');
const bootstrap = require('../../helpers/bootstrap');

const { ethers } = hre;

describe('UpgradeModule', function () {
  describe('when upgrading to a new Proxy', function () {
    const { deploymentInfo } = bootstrap();

    let UpgradeModule;
    before('identify module', async function () {
      const proxyAddress = getProxyAddress(deploymentInfo);
      UpgradeModule = await ethers.getContractAt('UpgradeModule', proxyAddress);
    });

    describe('when attempting to set the implementation with a non owner signer', function () {
      it('reverts', async function () {
        const [, user] = await ethers.getSigners();

        await assertRevert(
          UpgradeModule.connect(user).safeUpgradeTo(user.address),
          'OnlyOwnerAllowed()'
        );
      });
    });

    describe('when upgrading the Router implementation', function () {
      let NewRouter;
      before('prepare modules', async function () {
        const factory = await ethers.getContractFactory('Router');
        NewRouter = await factory.deploy();
      });

      it('sets the new address', async function () {
        assert.equal(await UpgradeModule.getImplementation(), getRouterAddress(deploymentInfo));

        const tx = await UpgradeModule.upgradeTo(NewRouter.address);
        await tx.wait();

        assert.equal(await UpgradeModule.getImplementation(), NewRouter.address);
      });
    });
  });
});
