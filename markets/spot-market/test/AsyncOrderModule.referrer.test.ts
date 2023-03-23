import { ethers as Ethers } from 'ethers';
import { bn, bootstrapTraders, bootstrapWithSynth } from './bootstrap';
import { SynthRouter } from '../generated/typechain';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';

describe('Atomic Order Module referrer', () => {
  const { systems, signers, marketId, restore } = bootstrapTraders(
    bootstrapWithSynth('Synthetic Ether', 'snxETH')
  ); // creates traders with USD

  let marketOwner: Ethers.Signer,
    trader1: Ethers.Signer,
    trader2: Ethers.Signer,
    referrer: Ethers.Signer;
  let synth: SynthRouter;

  before('identify actors', async () => {
    [, , marketOwner, trader1, trader2, referrer] = signers();
  });

  before('identify synth', async () => {
    const synthAddress = await systems().SpotMarket.getSynth(1);
    synth = systems().Synth(synthAddress);
  });

  describe('updateReferrerShare()', () => {
    before(restore);
    let txn: Ethers.providers.TransactionResponse;

    before('set referrer percentage to 10%', async () => {
      await systems()
        .SpotMarket.connect(marketOwner)
        .updateReferrerShare(marketId(), referrer, bn(0.1));
    });

    it('emitted ReferrerShareUpdated event with correct params', async () => {
      await assertEvent(
        txn,
        `ReferrerShareUpdated(${marketId()}, ${referrer.getAddress()}, ${bn(0.1)})`,
        systems().SpotMarket
      );
    });
  });

  describe('fixed fee', () => {
    before(restore);

    before('set referrer percentage to 10%', async () => {
      await systems()
        .SpotMarket.connect(marketOwner)
        .updateReferrerShare(marketId(), referrer, bn(0.1));
    });

    before('set fixed fee to 1%', async () => {
      await systems().SpotMarket.connect(marketOwner).setAtomicFixedFee(marketId(), bn(0.01));
    });

    it('referrer has 0 snxETH', async () => {
      assertBn.equal(await synth.balanceOf(await referrer.getAddress()), bn(0));
    });

    it('buy 1 snxETH', async () => {
      await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(1000));
      await systems().SpotMarket.connect(trader1).buy(marketId(), bn(1000), bn(0.99), referrer);
    });

    it('trader1 has 0.99 snxETH after fees', async () => {
      assertBn.equal(await synth.balanceOf(await trader1.getAddress()), bn(0.99));
    });

    it('referrer has 0.001 = 0.01 * 0.1 snxETH', async () => {
      assertBn.equal(await synth.balanceOf(await referrer.getAddress()), bn(0.001));
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
        .updateReferrerShare(marketId(), referrer, bn(0.1));
    });

    before('buy 50 snxETH', async () => {
      await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(50_000));
      await systems().SpotMarket.connect(trader1).buy(marketId(), bn(50_000), bn(50), referrer);
    });

    before('buy 100 snxETH', async () => {
      await systems().USD.connect(trader2).approve(systems().SpotMarket.address, bn(100_000));
      await systems().SpotMarket.connect(trader2).buy(marketId(), bn(100_000), bn(97.5), referrer);
    });

    it('referrer has 0 snxETH (only fixed fees are sent to referrer)', async () => {
      assertBn.equal(await synth.balanceOf(await referrer.getAddress()), bn(0));
    });
  });

  describe('skew fees', () => {
    before(restore);

    before('set skew scale to 100 snxETH', async () => {
      await systems().SpotMarket.connect(marketOwner).setMarketSkewScale(marketId(), bn(100));
    });

    before('set referrer percentage to 10%', async () => {
      await systems()
        .SpotMarket.connect(marketOwner)
        .updateReferrerShare(marketId(), referrer, bn(0.1));
    });

    before('trader1 buy 10 snxETH', async () => {
      await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(10_000));
      await systems().SpotMarket.connect(trader1).buy(marketId(), bn(10_000), bn(9.5), referrer);
    });

    before('trader2 buy 10 snxETH', async () => {
      await systems().USD.connect(trader2).approve(systems().SpotMarket.address, bn(10_000));
      await systems().SpotMarket.connect(trader2).buy(marketId(), bn(10_000), bn(8.55), referrer);
    });

    it('referrer has 0 snxETH (only fixed fees are sent to referrer)', async () => {
      assertBn.equal(await synth.balanceOf(await referrer.getAddress()), bn(0));
    });
  });
});
