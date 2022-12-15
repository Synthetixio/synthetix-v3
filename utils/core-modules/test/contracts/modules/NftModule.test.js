const { ethers } = hre;
const assert = require('assert/strict');
const { default: assertRevert } = require('@synthetixio/core-utils/utils/assertions/assert-revert');
const { bootstrap } = require('../../helpers/bootstrap.js');
const initializer = require('@synthetixio/core-modules/test/helpers/initializer');

describe('NftModule', () => {
  const { proxyAddress } = bootstrap(initializer, {
    modules: ['OwnerModule', 'UpgradeModule', 'NftModule'],
  });

  let NftModule;
  let owner, user;

  before('identify signers', async () => {
    [owner, user] = await ethers.getSigners();
  });

  before('identify modules', async () => {
    NftModule = await ethers.getContractAt('NftModule', proxyAddress());
  });

  describe('initialize()', () => {
    it('reverts when not owner', async () => {
      await assertRevert(
        NftModule.connect(user).initialize('Temp Token', 'TMP', 18),
        `Unauthorized("${await user.getAddress()}")`
      );
    });

    it('works with owner', async () => {
      await NftModule.connect(owner).initialize('Temp Token', 'TMP', 18);
      assert.equal(await NftModule.isInitialized(), true);
    });
  });
});
