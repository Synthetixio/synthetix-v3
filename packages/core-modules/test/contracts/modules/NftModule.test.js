const { ethers } = hre;
const assert = require('assert/strict');
const { default: assertRevert } = require('@synthetixio/core-js/dist/utils/assertions/assert-revert');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('@synthetixio/core-modules/test/helpers/initializer');

describe('NftModule', () => {
  const { proxyAddress } = bootstrap(initializer, { modules: '.*(Owner|Upgrade|Nft).*' });

  let NftModule;
  let owner, user;

  before('identify signers', async () => {
    [owner, user] = await ethers.getSigners();
  });

  before('identify modules', async () => {
    NftModule = await ethers.getContractAt('NftModule', proxyAddress());
  });

  describe('mint()', () => {
    it('reverts when not owner', async () => {
      await assertRevert(NftModule.connect(user).mint(user.address, 42), 'Unauthorized');
    });

    it('mints', async () => {
      await NftModule.connect(owner).mint(user.address, 42);
      assert.equal(await NftModule.ownerOf(42), user.address);
    });
  });
});
