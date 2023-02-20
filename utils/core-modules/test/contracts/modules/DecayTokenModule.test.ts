import assert from 'node:assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { snapshotCheckpoint } from '@synthetixio/main/test/utils/snapshot';
import { ethers } from 'ethers';
import { bootstrap } from '../../bootstrap';
import { DecayTokenModule } from '../../../typechain-types';
import { fastForward, fastForwardTo, getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';

const parseEther = ethers.utils.parseEther;

describe('DecayTokenModule', () => {
  const { getContractBehindProxy, getSigners, getProvider } = bootstrap({
    implementation: 'DecayTokenModuleRouter',
  });

  let TokenModule: DecayTokenModule;

  let owner: ethers.Signer;
  let user1: ethers.Signer;
  let user2: ethers.Signer;

  const decimal = 18;

  //1% decay per 1 seconds
  const interestRate = parseEther('315360');
  const amount = parseEther('100');

  before('identify signers', async () => {
    [owner, user1, user2] = await getSigners();
  });

  before('identify modules', async () => {
    TokenModule = getContractBehindProxy('DecayTokenModule');
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

  const restore = snapshotCheckpoint(getProvider);

  describe('mint', () => {
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

    describe('check the values at timestamp 1', () => {
      before('fast forward to timestamp 1', async () => {
        //sets next block timestamp
        await fastForward(1, getProvider());
      });

      it('totalSupply is 100 * (1 - (1 - 0) * 0.01) = 99', async () => {
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
      before('98.01 tokens is minted to user2.', async () => {
        //advance block timestamp
        await TokenModule.connect(owner).mint(await user2.getAddress(), parseEther('98.01'));
      });

      it('total supply is totalSupplyAtEpochStart + mintedTokens ==> (100 * ((1 - 0.01) ** 2) + 98.01) = 196.02', async () => {
        assertBn.equal(await TokenModule.totalSupply(), parseEther('196.02'));
      });

      it('token shares is (100 + (98.01 / 0.9801)) = 200', async () => {
        assertBn.equal(await TokenModule.totalShares(), parseEther('200'));
      });

      it('token per share is (196.02 / 200) = 0.9801', async () => {
        assertBn.equal(await TokenModule.tokensPerShare(), parseEther('0.9801'));
      });

      it('user 1 balance is 100 * 0.9801 = 98.01', async () => {
        assertBn.equal(await TokenModule.balanceOf(await user1.getAddress()), parseEther('98.01'));
      });

      it('user 2 balance is 100 * 0.9801 = 98.01', async () => {
        assertBn.equal(await TokenModule.balanceOf(await user2.getAddress()), parseEther('98.01'));
      });
    });
  });

  describe('changing interest rate over time', async () => {
    before(restore);

    before('100 tokens is minted to user1 at timestamp 0', async () => {
      await TokenModule.connect(owner).mint(await user1.getAddress(), amount);
    });

    describe('fast forward to timestamp 1', () => {
      before('fastForward', async () => {
        await fastForward(1, getProvider());
      });

      it('totalSupply is 100 * (1 - (1 - 0) * 0.01) = 99', async () => {
        assertBn.equal(await TokenModule.totalSupply(), parseEther('99'));
      });

      it('token per share is (99 / 100) = 0.99 ', async () => {
        assertBn.equal(await TokenModule.tokensPerShare(), parseEther('0.99'));
      });

      it('user 1 balance is 100 * 0.99 = 99', async () => {
        assertBn.equal(await TokenModule.balanceOf(await user1.getAddress()), parseEther('99'));
      });
    });
  });

  describe('check decay after 1 day', async () => {
    before(restore);

    before('update interest rate to 1% per day', async () => {
      await TokenModule.setInterestRate(parseEther('3.65'));
    });
    before('100 tokens is minted to user1 at timestamp 0', async () => {
      await TokenModule.connect(owner).mint(await user1.getAddress(), amount);
    });
    before('fast forward to timestamp 86400 (1day)', async () => {
      const start = await getTime(getProvider());
      await fastForwardTo(start + 86400, getProvider());
    });

    it('totalSupply is 100 * (1 - (1 - 0) * 0.01) = 99', async () => {
      assertBn.equal(await TokenModule.totalSupply(), parseEther('99.004983317622197'));
    });
    it('token per share is (99 / 100) = 0.99 ', async () => {
      assertBn.equal(await TokenModule.tokensPerShare(), parseEther('0.99'));
    });

    it('user 1 balance is 100 * 0.99 = 99', async () => {
      assertBn.equal(await TokenModule.balanceOf(await user1.getAddress()), parseEther('99'));
    });
  });

  describe('changing interest rate over time', async () => {
    before(restore);

    before('100 tokens is minted to user1 at timestamp 0', async () => {
      await TokenModule.connect(owner).mint(await user1.getAddress(), amount);
    });

    describe('fast forward to timestamp 2', () => {
      before('update interest rate to 2% per 1 seconds', async () => {
        await TokenModule.setInterestRate(interestRate.mul(2));
      });

      before('fastForward', async () => {
        await fastForward(1, getProvider());
      });

      it('totalSupply is 99 * (0.98) = 97.02', async () => {
        assertBn.equal(await TokenModule.totalSupply(), parseEther('97.02'));
      });

      it('token per share is (97.02 / 100) = 0.9604', async () => {
        assertBn.equal(await TokenModule.tokensPerShare(), parseEther('0.9702'));
      });

      it('user 1 balance is 100 * 0.9702 = 97.02', async () => {
        assertBn.equal(await TokenModule.balanceOf(await user1.getAddress()), parseEther('97.02'));
      });
    });
  });

  describe('transfer', async () => {
    before(restore);

    before('1000 tokens is minted to user1 at timestamp 0', async () => {
      await TokenModule.connect(owner).mint(await user1.getAddress(), parseEther('1000'));
    });

    it('transfer 99 token from user1 to the owner at timestamp 1', async () => {
      await TokenModule.connect(user1).transfer(await owner.getAddress(), parseEther('99'));
    });

    it('check owner balance', async () => {
      assertBn.equal(await TokenModule.balanceOf(await owner.getAddress()), parseEther('99'));
    });

    describe('when advancing more', function () {
      before('fast forward', async function () {
        await fastForward(1, getProvider());
      });

      it('check owner balance at timestamp 2', async () => {
        assertBn.equal(await TokenModule.balanceOf(await owner.getAddress()), parseEther('98.01'));
      });
    });
  });

  describe('transferFrom', async () => {
    before(restore);

    before('1000 tokens is minted to user1 at timestamp 0', async () => {
      await TokenModule.connect(owner).mint(await user1.getAddress(), parseEther('1000'));
    });

    it('user1 approves 100 tokens to be spent by the owner', async () => {
      await TokenModule.connect(user1).approve(await owner.getAddress(), parseEther('100'));
    });

    it('check owner allowance for user1 at', async () => {
      assertBn.equal(
        await TokenModule.allowance(await user1.getAddress(), await owner.getAddress()),
        parseEther('100')
      );
    });

    it('owner transfer 100 tokens from user1 to user2', async () => {
      await TokenModule.connect(owner).transferFrom(
        await user1.getAddress(),
        await user2.getAddress(),
        parseEther('100')
      );
    });
  });

  describe('gas check', async () => {
    it('mint after 1 minute', async () => {
      const start = await getTime(getProvider());
      await fastForwardTo(start + 60, getProvider());
      await TokenModule.connect(owner).mint(await user2.getAddress(), parseEther('1'));
    });
    it('mint after 1 hour', async () => {
      const start = await getTime(getProvider());
      await fastForwardTo(start + 3600, getProvider());
      await TokenModule.connect(owner).mint(await user2.getAddress(), parseEther('1'));
    });
    it('mint after 1 day', async () => {
      const start = await getTime(getProvider());
      await fastForwardTo(start + 60 * 60 * 24, getProvider());
      await TokenModule.connect(owner).mint(await user2.getAddress(), parseEther('1'));
    });
    it('mint after 1 month', async () => {
      const start = await getTime(getProvider());
      await fastForwardTo(start + 60 * 60 * 24 * 30, getProvider());
      await TokenModule.connect(owner).mint(await user2.getAddress(), parseEther('1'));
    });
    it('mint after 1 year', async () => {
      const start = await getTime(getProvider());
      await fastForwardTo(start + 60 * 60 * 24 * 30 * 12, getProvider());
      await TokenModule.connect(owner).mint(await user2.getAddress(), parseEther('1'));
    });
    it('mint after 2 years', async () => {
      const start = await getTime(getProvider());
      await fastForwardTo(start + 60 * 60 * 24 * 30 * 12 * 2, getProvider());
      await TokenModule.connect(owner).mint(await user2.getAddress(), parseEther('1'));
    });
  });
});
