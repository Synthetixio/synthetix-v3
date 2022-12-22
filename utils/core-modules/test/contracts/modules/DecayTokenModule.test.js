const { ethers } = hre;
const assert = require('assert/strict');
const { default: assertRevert } = require('@synthetixio/core-utils/utils/assertions/assert-revert');
const assertBn = require('@synthetixio/core-utils/utils/assertions/assert-bignumber');
const { bootstrap } = require('../../helpers/bootstrap.js');
const initializer = require('@synthetixio/core-modules/test/helpers/initializer');
const { fastForwardTo, getTime } = require('@synthetixio/core-utils/utils/hardhat/rpc');
const { snapshotCheckpoint } = require('../../utils/snapshot.js');

const parseEther = ethers.utils.parseEther;

describe('DecayTokenModule', () => {
  const { proxyAddress, provider } = bootstrap(initializer, {
    modules: ['OwnerModule', 'UpgradeModule', 'DecayTokenModule'],
  });

  let TokenModule;

  let owner, user1, user2, startTime;
  const decimal = 18;

  //1% decay per 10 seconds
  const interestRate = parseEther('31536');
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

  const restore = snapshotCheckpoint(provider);

  describe('mint', () => {
    before(async () => {
      startTime = await getTime(provider());
    });

    before('100 tokens is minted to user1', async () => {
      await TokenModule.connect(owner).mint(await user1.getAddress(), amount);
    });

    describe('check the values at timestamp 0', () => {
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

    describe('check the values at timestamp 20', () => {
      before('fast forward to timestamp 10', async () => {
        //sets next block timestamp
        await fastForwardTo(startTime + 11, provider());
      });

      it('totalSupply is 100 * (1 - (10 - 0) * 0.001) = 99', async () => {
        assertBn.equal(await TokenModule.totalSupply(), parseEther('99'));
      });

      it('token per share is (99 / 100) = 0.99 ', async () => {
        assertBn.equal(await TokenModule.tokensPerShare(), parseEther('0.99'));
      });

      it('user 1 balance is 100 * 0.99 = 99', async () => {
        assertBn.equal(await TokenModule.balanceOf(await user1.getAddress()), parseEther('99'));
      });
    });

    describe('mint for second user', async () => {
      before('fast forward to timestamp 19', async () => {
        await fastForwardTo(startTime + 20, provider());
      });

      before('196 tokens is minted to user2. 196 token === 200 shares (196 / 0.98)', async () => {
        //advance block timestamp
        await TokenModule.connect(owner).mint(await user2.getAddress(), parseEther('196'));
      });

      it('total supply is totalSupplyAtEpochStart + mintedTokens ==> (100 * (1 - (20 - 0) * 0.001) + 196) = 294', async () => {
        assertBn.equal(await TokenModule.totalSupply(), parseEther('294'));
      });

      it('token per share is (293.9 / 300) = 0.98', async () => {
        assertBn.equal(await TokenModule.tokensPerShare(), parseEther('0.98'));
      });

      it('user 1 balance is 100 * 0.98 = 98', async () => {
        assertBn.equal(await TokenModule.balanceOf(await user1.getAddress()), parseEther('98'));
      });

      it('user 2 balance is 196 * 1 = 98', async () => {
        assertBn.equal(await TokenModule.balanceOf(await user2.getAddress()), parseEther('196'));
      });

      describe('check the values at timestamp 30', () => {
        before('fast forward to timestamp 30', async () => {
          await fastForwardTo(startTime + 31, provider());
        });

        it('totalSupply is 294 * (1 - (30 - 20) * 0.001) = 291.06', async () => {
          assertBn.equal(await TokenModule.totalSupply(), parseEther('291.06'));
        });

        it('token per share is (291.06 / 300) = 0.9702', async () => {
          assertBn.equal(await TokenModule.tokensPerShare(), parseEther('0.9702'));
        });

        it('user 1 balance is 100 * 0.9702 = 97.02', async () => {
          assertBn.equal(
            await TokenModule.balanceOf(await user1.getAddress()),
            parseEther('97.02')
          );
        });

        it('user 2 balance is 200 * 0.9702 = 194.04', async () => {
          assertBn.equal(
            await TokenModule.balanceOf(await user2.getAddress()),
            parseEther('194.04')
          );
        });
      });
    });
  });

  describe('changing interest rate over time', async () => {
    before(restore);
    before(async () => {
      startTime = await getTime(provider());
    });
    before('100 tokens is minted to user1', async () => {
      await TokenModule.connect(owner).mint(await user1.getAddress(), amount);
    });

    describe('fast forward to timestamp 9', () => {
      before('fastForward', async () => {
        await fastForwardTo(startTime + 10, provider());
      });

      it('update interest rate to 2% per 10 seconds', async () => {
        //advance block timestamp
        await TokenModule.setInterestRate(interestRate.mul(2));
      });

      it('totalSupply is 100 * (1 - (10 - 0) * 0.001) = 99', async () => {
        assertBn.equal(await TokenModule.totalSupply(), parseEther('99'));
      });

      it('token per share is (99 / 100) = 0.99 ', async () => {
        assertBn.equal(await TokenModule.tokensPerShare(), parseEther('0.99'));
      });

      it('user 1 balance is 100 * 0.99 = 99', async () => {
        assertBn.equal(await TokenModule.balanceOf(await user1.getAddress()), parseEther('99'));
      });
    });

    describe('fast forward to timestamp 20', () => {
      before('fastForward', async () => {
        await fastForwardTo(startTime + 21, provider());
      });

      it('totalSupply is 99 * (1 - (10 - 0) * 0.002) = 97.02', async () => {
        assertBn.equal(await TokenModule.totalSupply(), parseEther('97.02'));
      });

      it('token per share is (97.02 / 100) = 0.9702 ', async () => {
        assertBn.equal(await TokenModule.tokensPerShare(), parseEther('0.9702'));
      });

      it('user 1 balance is 100 * 0.9702 = 97.02', async () => {
        assertBn.equal(await TokenModule.balanceOf(await user1.getAddress()), parseEther('97.02'));
      });
    });
  });

  describe('transfer', async () => {
    before(restore);
    before(async () => {
      startTime = await getTime(provider());
    });
    before('1000 tokens is minted to user1', async () => {
      await TokenModule.connect(owner).mint(await user1.getAddress(), parseEther('1000'));
    });

    it('transfer 99 token from user1 to the owner at timestamp 10', async () => {
      await fastForwardTo(startTime + 10, provider());
      //advance 1 block
      await TokenModule.connect(user1).transfer(await owner.getAddress(), parseEther('99'));
    });

    it('check owner balance', async () => {
      assertBn.equal(await TokenModule.balanceOf(await owner.getAddress()), parseEther('99'));
    });

    it('check owner balance at timestamp 20', async () => {
      await fastForwardTo(startTime + 21, provider());
      assertBn.equal(await TokenModule.balanceOf(await owner.getAddress()), parseEther('98'));
    });
  });

  describe('transferFrom', async () => {
    before(restore);
    before(async () => {
      startTime = await getTime(provider());
    });
    before('1000 tokens is minted to user1', async () => {
      await TokenModule.connect(owner).mint(await user1.getAddress(), parseEther('1000'));
    });

    it('user1 approves 100 tokens to be spent by the owner', async () => {
      await TokenModule.connect(user1).approve(await owner.getAddress(), parseEther('100'));
    });

    it('check owner allowance for user1', async () => {
      assertBn.equal(
        await TokenModule.allowance(await user1.getAddress(), await owner.getAddress()),
        parseEther('100')
      );
    });

    it('owner transfer 100 tokens from user1', async () => {
      await TokenModule.connect(owner).transferFrom(
        await user1.getAddress(),
        await owner.getAddress(),
        parseEther('100')
      );
    });
  });
});
