const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');

describe('AccountRBACMixin', function () {
  const { proxyAddress } = bootstrap(initializer);

  let owner, user1, user2;

  let AccountModule, accountTokenAddress, AccountToken;
  let AccountRBACMixinMock;

  before('identify signers', async () => {
    [owner, user1, user2] = await ethers.getSigners();
  });

  before('identify modules', async () => {
    AccountModule = await ethers.getContractAt('AccountModule', proxyAddress());
    await (await AccountModule.connect(owner).initializeAccountModule()).wait();
    accountTokenAddress = await AccountModule.getAccountAddress();

    AccountToken = await ethers.getContractAt('AccountToken', accountTokenAddress);

    AccountRBACMixinMock = await ethers.getContractAt('AccountRBACMixinModuleMock', proxyAddress());
  });

  before('mint an account token', async () => {
    await (await AccountModule.connect(user1).mintAccount(1)).wait();
  });

  it('is minted', async () => {
    assert.equal(await AccountToken.ownerOf(1), user1.address);
    assertBn.equal(await AccountToken.balanceOf(user1.address), 1);
  });

  describe('when accessing as owner', () => {
    it('can interact with the contract', async () => {
      await (await AccountRBACMixinMock.connect(user1).interactWithAccount(1, 42)).wait();
      assertBn.equal(await AccountRBACMixinMock.getRBACValue(), 42);
    });

    describe('when attempting to interact as non owner', async () => {
      it('reverts', async () => {
        await assertRevert(
          AccountRBACMixinMock.connect(user2).interactWithAccount(1, 1337),
          `RoleNotAuthorized(1, "${ethers.utils.formatBytes32String('stake')}", "${user2.address}")`
        );
      });
    });
  });
});
