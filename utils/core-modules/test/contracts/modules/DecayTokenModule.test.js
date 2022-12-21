const { ethers } = hre;
const assert = require('assert/strict');
const { default: assertRevert } = require('@synthetixio/core-utils/utils/assertions/assert-revert');
const assertBn = require('@synthetixio/core-utils/utils/assertions/assert-bignumber');
const { bootstrap } = require('../../helpers/bootstrap.js');
const initializer = require('@synthetixio/core-modules/test/helpers/initializer');
const { fastForwardTo, getTime } = require('@synthetixio/core-utils/utils/hardhat/rpc');

describe.only('DecayTokenModule', () => {
  const { proxyAddress, provider } = bootstrap(initializer, {
    modules: ['OwnerModule', 'UpgradeModule', 'DecayTokenModule'],
  });

  let TokenModule;

  let owner, user1, startTime;

  //1% decay per second
  let interestRate = 31536000;

  before('identify signers', async () => {
    [owner, user1] = await ethers.getSigners();
  });

  before('identify modules', async () => {
    TokenModule = await ethers.getContractAt('DecayTokenModule', proxyAddress());
  });

  before('set interest rate', async () => {
    const tx = await TokenModule.connect(owner).setInterestRate(interestRate);
    await TokenModule.connect(owner).initialize('Synthetix Network Token', 'snx', 18);
    await tx.wait();
  });

  describe('When attempting to initialize it again', () => {
    it('reverts', async () => {
      await assertRevert(
        TokenModule.initialize('Synthetix Network Token Updated', 'snx', 18),
        'AlreadyInitialized()'
      );
    });
  });

  describe('Before minting any tokens', () => {
    it('the total supply is 0', async () => {
      assertBn.equal(await TokenModule.totalSupply(), 0);
    });

    it('the constructor arguments are set correctly', async () => {
      assert.equal(await TokenModule.name(), 'Synthetix Network Token');
      assert.equal(await TokenModule.symbol(), 'snx');
      assertBn.equal(await TokenModule.decimals(), 18);
      assertBn.equal(await TokenModule.interestRate(), interestRate);
    });
  });

  describe('mint', () => {
    before(async () => {
      startTime = await getTime(provider());
    });
    it('user 1 mints 100 token', async () => {
      await TokenModule.connect(owner).mint(await user1.getAddress(), 100);
    });

    it('balanceOf1', async () => {
      assertBn.equal(await TokenModule.balanceOf(await user1.getAddress()), 100);
    });

    it('totalSupply', async () => {
      await fastForwardTo(startTime + 3, provider());
      assertBn.equal(await TokenModule.totalSupply(), 98);
    });

    it('tokensPerShare', async () => {
      assertBn.equal(await TokenModule.tokensPerShare(), 98);
    });
  });
});
