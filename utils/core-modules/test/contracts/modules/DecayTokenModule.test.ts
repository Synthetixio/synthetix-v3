import assert from 'node:assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { fastForwardTo, getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { ethers } from 'ethers';
import { DecayTokenModule } from '../../../typechain-types';
import { bootstrap } from '../../bootstrap';

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

  //1% decay per 1 second
  const decayRate = parseEther('315360');
  const amount = parseEther('100');

  before('identify signers', async () => {
    [owner, user1, user2] = await getSigners();
  });

  before('identify modules', async () => {
    TokenModule = getContractBehindProxy('DecayTokenModule');
  });

  before('set decay rate', async () => {
    const tx = await TokenModule.connect(owner).setDecayRate(decayRate);
    await TokenModule.connect(owner).initialize('Synthetix Network Token', 'snx', decimal);
    await tx.wait();
  });

  const restore = snapshotCheckpoint(getProvider);

  describe('When attempting to initialize it again', () => {
    it('with new decimal reverts', async () => {
      await assertRevert(
        TokenModule.initialize('Synthetix Network Token Updated', 'snx', decimal + 1),
        'AlreadyInitialized()'
      );
    });

    it('with the same decimal', async () => {
      await TokenModule.initialize('Synthetix Network Token Updated', 'snx2', decimal);

      assert.equal(await TokenModule.name(), 'Synthetix Network Token Updated');
      assert.equal(await TokenModule.symbol(), 'snx2');
      assertBn.equal(await TokenModule.decimals(), 18);
    });
  });

  describe('Before minting any tokens', () => {
    before(restore);

    it('the total supply is 0', async () => {
      assertBn.equal(await TokenModule.totalSupply(), 0);
    });

    it('the constructor arguments are set correctly', async () => {
      assert.equal(await TokenModule.name(), 'Synthetix Network Token');
      assert.equal(await TokenModule.symbol(), 'snx');
      assertBn.equal(await TokenModule.decimals(), decimal);
      assertBn.equal(await TokenModule.decayRate(), decayRate);
      assert.equal(await TokenModule.isInitialized(), true);
    });
  });

  describe('mint', () => {
    before('100 tokens is minted to user1', async () => {
      await TokenModule.connect(owner).mint(await user1.getAddress(), amount);
    });

    describe('check the values at timestamp 0', () => {
      it('total supply is 100', async () => {
        assertBn.equal(await TokenModule.totalSupply(), amount);
      });

      it('user1 balance is 100 * 1 = 100', async () => {
        assertBn.equal(await TokenModule.balanceOf(await user1.getAddress()), amount);
      });
    });

    describe('check the values at timestamp 1', () => {
      before('fast forward to timestamp 1', async () => {
        const start = await getTime(getProvider());
        await fastForwardTo(start + 1, getProvider());
      });

      it('totalSupply is 100 * (1 - (1 - 0) * 0.01) = 99', async () => {
        assertBn.equal(await TokenModule.totalSupply(), parseEther('99'));
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

      it('user 1 balance is 100 * 0.9801 = 98.01', async () => {
        assertBn.equal(await TokenModule.balanceOf(await user1.getAddress()), parseEther('98.01'));
      });

      it('user 2 balance is 100 * 0.9801 = 98.01', async () => {
        assertBn.equal(await TokenModule.balanceOf(await user2.getAddress()), parseEther('98.01'));
      });
    });
  });

  describe('changing decay rate over time', async () => {
    before(restore);

    before('100 tokens is minted to user1 at timestamp 0', async () => {
      await TokenModule.connect(owner).mint(await user1.getAddress(), amount);
    });

    describe('fast forward to timestamp 2', () => {
      before('update decay rate to 2% per 1 seconds', async () => {
        await TokenModule.setDecayRate(decayRate.mul(2));
      });

      before('fastForward to timestamp 2', async () => {
        const start = await getTime(getProvider());
        await fastForwardTo(start + 1, getProvider());
      });

      it('totalSupply is 99 * (0.98) = 97.02', async () => {
        assertBn.equal(await TokenModule.totalSupply(), parseEther('97.02'));
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
        const start = await getTime(getProvider());
        await fastForwardTo(start + 1, getProvider());
      });

      it('check owner balance at timestamp 2', async () => {
        assertBn.equal(await TokenModule.balanceOf(await owner.getAddress()), parseEther('98.01'));
      });
    });
  });

  describe('transferFrom', async () => {
    describe('check approval and transfer from after 1 second', () => {
      before(restore);

      before('1000 tokens is minted to user1 at timestamp 0', async () => {
        await TokenModule.connect(owner).mint(await user1.getAddress(), parseEther('1000'));
      });

      it('user1 approves 100 tokens to be spent by the owner', async () => {
        await TokenModule.connect(user1).approve(await owner.getAddress(), parseEther('100'));
      });

      it('check owner allowance for user1 after 1 second', async () => {
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

      it('check owner allowance for user1 after transfer', async () => {
        assertBn.equal(
          await TokenModule.allowance(await user1.getAddress(), await owner.getAddress()),
          parseEther('0')
        );
      });

      it('check user 2 balance', async () => {
        assertBn.equal(
          await TokenModule.balanceOf(await user2.getAddress()),
          parseEther('99.999999999999999999')
        );
      });
    });

    describe('check approval and transfer from after 1 day', () => {
      before(restore);

      before('1000 tokens is minted to user1 at timestamp 0', async () => {
        await TokenModule.connect(owner).mint(await user1.getAddress(), parseEther('1000'));
      });

      it('user1 approves 100 tokens to be spent by the owner', async () => {
        await TokenModule.connect(user1).approve(await owner.getAddress(), parseEther('100'));
      });

      before('fast forward to timestamp 86400 (1day)', async () => {
        const start = await getTime(getProvider());
        await fastForwardTo(start + 86400, getProvider());
      });

      it('check owner allowance for user1 after 1day', async () => {
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

      it('check user 2 balance', async () => {
        assertBn.equal(await TokenModule.balanceOf(await user2.getAddress()), parseEther('100'));
      });
    });

    describe('check approval and transfer from after 1 year', () => {
      before(restore);

      before('1000 tokens is minted to user1 at timestamp 0', async () => {
        await TokenModule.connect(owner).mint(await user1.getAddress(), parseEther('1000'));
      });

      it('user1 approves 100 tokens to be spent by the owner', async () => {
        await TokenModule.connect(user1).approve(await owner.getAddress(), parseEther('100'));
      });

      before('fast forward to timestamp 31536000 (1year)', async () => {
        const start = await getTime(getProvider());
        await fastForwardTo(start + 31536000, getProvider());
      });

      it('check owner allowance for user1 after 1year', async () => {
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
  });

  describe('decay after 1 day', async () => {
    before(restore);

    before('update decay rate to 1% per day', async () => {
      await TokenModule.setDecayRate(parseEther('3.65'));
    });

    before('100 tokens is minted to user1 at timestamp 0', async () => {
      await TokenModule.connect(owner).mint(await user1.getAddress(), amount);
    });

    before('fast forward to timestamp 86400 (1day)', async () => {
      const start = await getTime(getProvider());
      await fastForwardTo(start + 86400, getProvider());
    });

    it('totalSupply is 100 * ((1 - (0.01/86400)) ** 86400) ~ 99.004983317622197', async () => {
      // continues compound interest rate
      // 99.0049833749168 = 100 * Math.pow(Math.E, -3.65 / 365);

      // compound interest rate
      // seconds in a year = 31536000
      // rate per second = 3.65 / 31536000 = 0.000000115740741
      // seconds in a day = 86400
      // 99.00498331547897 = 100 * Math.pow(1 - 0.000000115740741, 86400);

      assertBn.equal(await TokenModule.totalSupply(), parseEther('99.004983317622197'));

      // 0.000000057870423% Deviation from continuous rate amount
      // 0.000000002164767% Deviation from compound rate amount
    });

    it('user 1 balance is 100 * 0.99004983317622197 = 99.004983317622197', async () => {
      assertBn.equal(
        await TokenModule.balanceOf(await user1.getAddress()),
        parseEther('99.004983317622197')
      );
    });
  });

  describe('decay after 1 year', async () => {
    before(restore);

    before('update decay rate to 2% per year', async () => {
      await TokenModule.setDecayRate(parseEther('0.02'));
    });

    before('100 tokens is minted to user1 at timestamp 0', async () => {
      await TokenModule.connect(owner).mint(await user1.getAddress(), amount);
    });

    before('fast forward to timestamp 31536000 (1year)', async () => {
      const start = await getTime(getProvider());
      await fastForwardTo(start + 31536000, getProvider());
    });

    it('totalSupply is 100 * ((1 - (0.02/31536000)) ** 31536000) ~ 98.0198673305761728', async () => {
      // continues compound interest rate
      // 98.01986733067552 = 100 * Math.pow(Math.E, -0.02 * 1);

      // compound interest rate
      // seconds in a year = 31536000
      // rate per second = 0.02 / 31536000 = 0.000000000634196
      // 98.0198668344654 = 100 * Math.pow(1 - 0.000000115740741, 31536000);

      assertBn.equal(await TokenModule.totalSupply(), parseEther('98.0198673305761728'));

      // 0.000000000101354% Deviation from continuous rate amount
      // 0.000000506132878% Deviation from compound rate amount
    });

    it('user 1 balance is 100 * 0.980198673305761728 = 98.0198673305761728', async () => {
      assertBn.equal(
        await TokenModule.balanceOf(await user1.getAddress()),
        parseEther('98.0198673305761728')
      );
    });
  });

  describe('set decay rate limits', async () => {
    before(restore);

    const DECAY_RATE_UPPER_BOUND = ethers.utils.parseEther('31536000');

    it('can set the decay rate to the upper bound', async () => {
      await TokenModule.connect(owner).setDecayRate(DECAY_RATE_UPPER_BOUND);
      assertBn.equal(await TokenModule.decayRate(), DECAY_RATE_UPPER_BOUND);
    });

    it('cannot set the decay rate above the upper bound', async () => {
      await assertRevert(
        TokenModule.connect(owner).setDecayRate(DECAY_RATE_UPPER_BOUND.add(1)),
        'InvalidDecayRate()'
      );
    });
  });
});
