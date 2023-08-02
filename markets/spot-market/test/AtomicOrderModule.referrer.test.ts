import { ethers as Ethers } from 'ethers';
import { bn, bootstrapTraders, bootstrapWithSynth } from './bootstrap';
import { SynthRouter } from './generated/typechain';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';

describe('Atomic Order Module referrer', () => {
  const { systems, signers, marketId, aggregator, restore } = bootstrapTraders(
    bootstrapWithSynth('Synthetic Ether', 'snxETH')
  ); // creates traders with USD

  let marketOwner: Ethers.Signer,
    trader1: Ethers.Signer,
    trader2: Ethers.Signer,
    referrer: Ethers.Signer;
  let synth: SynthRouter;

  before('identify actors', async () => {
    [, , marketOwner, trader1, trader2, , , , , referrer] = signers();
  });

  before('identify synth', async () => {
    const synthAddress = await systems().SpotMarket.getSynth(1);
    synth = systems().Synth(synthAddress);
  });

  describe('updateReferrerShare()', () => {
    before(restore);
    let txn: Ethers.providers.TransactionResponse;

    before('set referrer percentage to 10%', async () => {
      txn = await systems()
        .SpotMarket.connect(marketOwner)
        .updateReferrerShare(marketId(), await referrer.getAddress(), bn(0.1));
    });

    it('emitted ReferrerShareUpdated event with correct params', async () => {
      await assertEvent(
        txn,
        `ReferrerShareUpdated(${marketId()}, "${await referrer.getAddress()}", ${bn(0.1)})`,
        systems().SpotMarket
      );
    });
  });

  describe('fixed fee', () => {
    before(restore);

    before('set referrer percentage to 10%', async () => {
      await systems()
        .SpotMarket.connect(marketOwner)
        .updateReferrerShare(marketId(), await referrer.getAddress(), bn(0.1));
    });

    before('set fixed fee to 1%', async () => {
      await systems().SpotMarket.connect(marketOwner).setAtomicFixedFee(marketId(), bn(0.01));
    });

    it('referrer has 0 USD', async () => {
      assertBn.equal(await systems().USD.balanceOf(await referrer.getAddress()), bn(0));
    });

    it('buy 1 snxETH', async () => {
      await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(1000));
      await systems()
        .SpotMarket.connect(trader1)
        .buy(marketId(), bn(1000), bn(0.99), await referrer.getAddress());
    });

    it('trader1 has 0.99 snxETH after fees', async () => {
      assertBn.equal(await synth.balanceOf(await trader1.getAddress()), bn(0.99));
    });

    it('referrer has 1 = 0.01 * 0.1 * 1000 USD (fixedFee * referrerPercentage * amount)', async () => {
      assertBn.equal(await systems().USD.balanceOf(await referrer.getAddress()), bn(1));
    });
  });

  describe('utilization rate fees', async () => {
    before(restore);

    before('set utilization fee to 1%', async () => {
      await systems()
        .SpotMarket.connect(marketOwner)
        .setMarketUtilizationFees(marketId(), bn(0.001));
    });

    before('set referrer percentage to 10%', async () => {
      await systems()
        .SpotMarket.connect(marketOwner)
        .updateReferrerShare(marketId(), await referrer.getAddress(), bn(0.1));
    });

    before('buy 50 snxETH', async () => {
      await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(50_000));
      await systems()
        .SpotMarket.connect(trader1)
        .buy(marketId(), bn(50_000), bn(50), await referrer.getAddress());
    });

    before('buy 100 snxETH', async () => {
      await systems().USD.connect(trader2).approve(systems().SpotMarket.address, bn(100_000));
      await systems()
        .SpotMarket.connect(trader2)
        .buy(marketId(), bn(100_000), bn(97.5), await referrer.getAddress());
    });

    it('referrer has 0 USD (only fixed fees are sent to referrer)', async () => {
      assertBn.equal(await systems().USD.balanceOf(await referrer.getAddress()), bn(0));
    });
  });

  describe('skew fees', () => {
    before(restore);

    before('set skew scale to 100 snxETH', async () => {
      await systems().SpotMarket.connect(marketOwner).setMarketSkewScale(marketId(), bn(100));
    });

    before('set fixed fee to 1%', async () => {
      await systems().SpotMarket.connect(marketOwner).setAtomicFixedFee(marketId(), bn(0.01));
    });

    before('set referrer percentage to 10%', async () => {
      await systems()
        .SpotMarket.connect(marketOwner)
        .updateReferrerShare(marketId(), await referrer.getAddress(), bn(0.1));
    });

    before('trader1 buy 10 snxETH', async () => {
      await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(10_000));
      await systems()
        .SpotMarket.connect(trader1)
        .buy(marketId(), bn(10_000), bn(9.4), await referrer.getAddress());
    });

    it('referrer has 10 = 0.01 * 0.1 * 10,000 USD', async () => {
      assertBn.equal(await systems().USD.balanceOf(await referrer.getAddress()), bn(10));
    });

    it('trader2 buy 10 snxETH', async () => {
      await systems().USD.connect(trader2).approve(systems().SpotMarket.address, bn(10_000));
      await systems()
        .SpotMarket.connect(trader2)
        .buy(marketId(), bn(10_000), bn(8.55), await referrer.getAddress());
    });

    it('referrer has 10 = 0.01 * 0.1 * 10,000 USD', async () => {
      assertBn.equal(await systems().USD.balanceOf(await referrer.getAddress()), bn(20));
    });

    it('trader1 sell 5 snxETH', async () => {
      await synth.connect(trader1).approve(systems().SpotMarket.address, bn(5));
      await systems()
        .SpotMarket.connect(trader1)
        .sell(marketId(), bn(5), bn(5000), await referrer.getAddress());
    });

    it('referrer has 4.5 = 0.01 * 0.1 * 4500 USD', async () => {
      assertBn.equal(await systems().USD.balanceOf(await referrer.getAddress()), bn(24.5));
    });
  });

  describe('check system balance', () => {
    before(restore);

    before('set referrer percentage to 10%', async () => {
      await systems()
        .SpotMarket.connect(marketOwner)
        .updateReferrerShare(marketId(), await referrer.getAddress(), bn(0.1));
    });

    before('set fixed fee to 1%', async () => {
      await systems().SpotMarket.connect(marketOwner).setAtomicFixedFee(marketId(), bn(0.01));
    });

    before('set custom fee collector', async () => {
      await systems()
        .SpotMarket.connect(marketOwner)
        .setFeeCollector(marketId(), systems().FeeCollectorMock.address);
    });

    it('check balances before transaction', async () => {
      assertBn.equal(await systems().USD.balanceOf(await referrer.getAddress()), bn(0));
      assertBn.equal(await systems().USD.balanceOf(systems().SpotMarket.address), bn(0));
      assertBn.equal(await systems().USD.balanceOf(systems().FeeCollectorMock.address), bn(0));
    });

    it('buy 1 snxETH', async () => {
      await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(1000));
      await systems()
        .SpotMarket.connect(trader1)
        .buy(marketId(), bn(1000), bn(0.99), await referrer.getAddress());
    });

    it('check balances after transaction', async () => {
      assertBn.equal(await synth.balanceOf(await trader1.getAddress()), bn(0.99));
      assertBn.equal(await systems().USD.balanceOf(await referrer.getAddress()), bn(1));
      assertBn.equal(await systems().USD.balanceOf(systems().SpotMarket.address), bn(0));
    });

    it('check mock fee collector balance 4.5 = (10 - 1)/2 (collects 50% of the fees)', async () => {
      assertBn.equal(await systems().USD.balanceOf(systems().FeeCollectorMock.address), bn(4.5));
    });
  });

  describe('total fees calc', () => {
    before(restore);

    // make skew 1 snxETH
    before('buy 1 snxETH', async () => {
      await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(1000));
      await systems()
        .SpotMarket.connect(trader1)
        .buy(marketId(), bn(1000), bn(0.99), await referrer.getAddress());
    });

    before('set sell price to $1000', async () => {
      await aggregator().mockSetCurrentPrice(bn(1000));
    });

    before('set skew scale to 10 snxETH', async () => {
      await systems().SpotMarket.connect(marketOwner).setMarketSkewScale(marketId(), bn(10));
    });

    before('set fixed fee to 10%', async () => {
      await systems().SpotMarket.connect(marketOwner).setAtomicFixedFee(marketId(), bn(0.1));
    });

    before('set referrer percentage to 80%', async () => {
      await systems()
        .SpotMarket.connect(marketOwner)
        .updateReferrerShare(marketId(), await referrer.getAddress(), bn(0.8));
    });

    before('sell 1 snxETH', async () => {
      await synth.connect(trader1).approve(systems().SpotMarket.address, bn(1));
      // total fees = $50
      // fixed fee = $1000 * 0.1 = $100
      // skew fee = 0.05 * $900 = -$50
      // referrer = $100 * 0.8 = $80
      // test where total fees is positive but after collected referrer its negative

      await systems()
        .SpotMarket.connect(trader1)
        .sellExactIn(marketId(), bn(1), bn(500), await referrer.getAddress());
    });

    it('referrer received $80', async () => {
      assertBn.equal(await systems().USD.balanceOf(await referrer.getAddress()), bn(80));
    });
  });
});
