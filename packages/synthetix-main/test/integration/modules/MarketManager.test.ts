import hre from 'hardhat';
import assert from 'assert/strict';
import assertRevert from '@synthetixio/core-js/utils/assertions/assert-revert';
import { findEvent } from '@synthetixio/core-js/utils/ethers/events';
import { bootstrap } from '../bootstrap';
import assertBn from '@synthetixio/core-js/utils/assertions/assert-bignumber';
import { ethers } from 'ethers';

describe.skip('MarketManager', function () {
  const { signers, systems } = bootstrap();

  const One = ethers.utils.parseEther('1');
  const Hundred = ethers.utils.parseEther('100');

  let owner: ethers.Signer, user1: ethers.Signer;

  let Market1: ethers.Contract;
  let market1id: ethers.BigNumber;

  before('identify signers', async () => {
    [owner, user1] = signers();
  });

  before('identify modules', async () => {
    // Use USDTokenMock to manually mint USD
    const factory = await hre.ethers.getContractFactory('USDTokenMock');
    const USDTokenMock = await factory.connect(owner).deploy();
    await (
      await systems()
        .Core.connect(owner)
        .initOrUpgradeToken(USDTokenMock.address)
    ).wait();
  });

  before('create dummy markets', async () => {
    Market1 = await (await hre.ethers.getContractFactory('MarketMock'))
      .connect(owner)
      .deploy();
  });

  describe('when a market is registered', async () => {
    let receipt: ethers.providers.TransactionReceipt;

    before('register a market', async () => {
      receipt = await (
        await systems().Core.connect(owner).registerMarket(Market1.address)
      ).wait();
    });

    it('emmited an event', async () => {
      const event = findEvent({ receipt, eventName: 'MarketRegistered' });
      assert(event.args.market, Market1.address);
      market1id = event.args.marketId;
      await (
        await Market1.connect(owner).initialize(
          systems().Core.address,
          market1id,
          One
        )
      ).wait();
      assert.equal(market1id.toNumber(), 1);
    });

    it('liquidity is zero', async () => {
      assertBn.equal(await systems().Core.liquidity(market1id), 0);
    });

    it('totalBalance is zero', async () => {
      assertBn.equal(await systems().Core.totalBalance(market1id), 0);
    });

    describe('when attempting to register a market again', async () => {
      it('reverts', async () => {
        await assertRevert(
          systems().Core.connect(owner).registerMarket(Market1.address),
          `MarketAlreadyRegistered("${Market1.address}")`
        );
      });
    });

    describe('before the market received liquidity', async () => {
      describe('when attempting to sell synths', async () => {
        it('reverts', async () => {
          await assertRevert(
            Market1.connect(user1).sellSynth(Hundred),
            `NotEnoughLiquidity(${market1id}, ${Hundred.toString()})`
          );
        });
      });

      describe('when someone buys some synths', async () => {
        let liquidityBefore: ethers.BigNumber;
        before('mint USD to use market', async () => {
          liquidityBefore = await systems().Core.liquidity(market1id);
          await (
            await systems().USD.connect(user1)['mint(uint256)'](Hundred)
          ).wait();
          await (
            await systems().USD.connect(user1).approve(Market1.address, Hundred)
          ).wait();
        });

        before('user1 buys some synth (deposit USD)', async () => {
          await (await Market1.connect(user1).buySynth(Hundred)).wait();
        });

        it('issuance increased liquidity', async () => {
          const liquidity = await systems().Core.liquidity(market1id);
          assertBn.equal(liquidity, liquidityBefore.add(Hundred));
        });
      });
    });
  });
});
