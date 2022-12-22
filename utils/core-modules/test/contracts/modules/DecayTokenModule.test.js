const { ethers } = hre;
const assert = require('assert/strict');
const { default: assertRevert } = require('@synthetixio/core-utils/utils/assertions/assert-revert');
const assertBn = require('@synthetixio/core-utils/utils/assertions/assert-bignumber');
const { bootstrap } = require('../../helpers/bootstrap.js');
const initializer = require('@synthetixio/core-modules/test/helpers/initializer');
const { fastForwardTo, getTime } = require('@synthetixio/core-utils/utils/hardhat/rpc');

const parseEther = ethers.utils.parseEther;

describe.only('DecayTokenModule', () => {
  const { proxyAddress, provider } = bootstrap(initializer, {
    modules: ['OwnerModule', 'UpgradeModule', 'DecayTokenModule'],
  });

  let TokenModule;

  let owner, user1, user2, startTime;
  const decimal = 18;

  //1% decay per second
  const interestRate = parseEther('315360');
  const amount = parseEther('100');

  before('identify signers', async () => {
    [owner, user1, user2] = await ethers.getSigners();
  });

  before('identify modules', async () => {
    TokenModule = await ethers.getContractAt('DecayTokenModule', proxyAddress());
  });

  before('set interest rate', async () => {
    const tx = await TokenModule.connect(owner).setInterestRate(interestRate);
    await TokenModule.connect(owner).initialize('Synthetix Network Token', 'snx', decimal);
    await tx.wait();
  });

  describe('When attempting to initialize it again', () => {
    it('reverts', async () => {
      await assertRevert(
        TokenModule.initialize('Synthetix Network Token Updated', 'snx', decimal),
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
      assertBn.equal(await TokenModule.decimals(), decimal);
      assertBn.equal(await TokenModule.interestRate(), interestRate);
    });
  });

  describe('mint', () => {
    before(async () => {
      startTime = await getTime(provider());
    });
    before('100 tokens is minted to user1', async () => {
      await TokenModule.connect(owner).mint(await user1.getAddress(), amount);
    });

    describe('check values at timestamp 0', () => {
      it('total supply is 100', async () => {
        assertBn.equal(await TokenModule.totalSupply(), amount);
      });

      it('token per share is 100 / 100 = 1', async () => {
        assertBn.equal(await TokenModule.tokensPerShare(), parseEther('1'));
      });

      it('user1 balance is 100 * 1 = 100', async () => {
        assertBn.equal(await TokenModule.balanceOf(await user1.getAddress()), amount);
      });
    });

    describe('check values at timestamp 2', () => {
      before('100 tokens is minted to user1', async () => {
        //sets next block timestamp
        await fastForwardTo(startTime + 3, provider());
      });

      it('totalSupply is 100 * (1 - (2 - 0) * 0.01) = 98', async () => {
        assertBn.equal(await TokenModule.totalSupply(), parseEther('98'));
      });

      it('token per share is (98 / 100) = 0.98 ', async () => {
        assertBn.equal(await TokenModule.tokensPerShare(), parseEther('0.98'));
      });

      it('user 1 balance is 100 * 0.98 = 98', async () => {
        assertBn.equal(await TokenModule.balanceOf(await user1.getAddress()), parseEther('98'));
      });
    });
  });
});
