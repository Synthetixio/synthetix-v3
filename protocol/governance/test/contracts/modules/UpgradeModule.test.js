const assert = require('assert/strict');
const assertRevert = require('@synthetixio/core-utils/utils/assertions/assert-revert');

const { bootstrap } = require('@synthetixio/router/dist/utils/tests');
const initializer = require('@synthetixio/core-modules/test/helpers/initializer');

const { ethers } = hre;

describe('UpgradeModule', function () {
  describe('when upgrading to a new Proxy', function () {
    const { proxyAddress, routerAddress } = bootstrap(initializer);

    let UpgradeModule;
    before('identify module', async function () {
      UpgradeModule = await ethers.getContractAt(
        'contracts/modules/UpgradeModule.sol:UpgradeModule',
        proxyAddress()
      );
    });

    describe('when attempting to set the implementation with a non owner signer', function () {
      it('reverts', async function () {
        const [, user] = await ethers.getSigners();

        await assertRevert(UpgradeModule.connect(user).upgradeTo(user.address), 'Unauthorized');
      });
    });

    describe('when upgrading the Router implementation', function () {
      let NewRouter;
      before('prepare modules', async function () {
        const factory = await ethers.getContractFactory('Router');
        NewRouter = await factory.deploy();
      });

      it('sets the new address', async function () {
        assert.equal(await UpgradeModule.getImplementation(), routerAddress());

        const tx = await UpgradeModule.upgradeTo(NewRouter.address);
        await tx.wait();

        assert.equal(await UpgradeModule.getImplementation(), NewRouter.address);
      });
    });
  });
});
