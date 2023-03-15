import { ethers as Ethers } from 'ethers';
import { bn, bootstrapTraders, bootstrapWithSynth } from './bootstrap';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { SynthRouter } from '../generated/typechain';
import { snapshotCheckpoint } from '@synthetixio/main/test/utils/snapshot';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';

describe.only('buy exact in skew test', () => {
  const { systems, signers, marketId, aggregator, provider } = bootstrapTraders(
    bootstrapWithSynth('Synthetic Ether', 'snxETH')
  ); // creates traders with USD

  let marketOwner: Ethers.Signer, trader1: Ethers.Signer, trader2: Ethers.Signer;
  let synth: SynthRouter;

  before('set mock sell price to be same as buy', async () => {
    await aggregator().mockSetCurrentPrice(bn(1000));
  });

  before('identify', async () => {
    [, , marketOwner, trader1, trader2] = signers();
    const synthAddress = await systems().SpotMarket.getSynth(1);
    synth = systems().Synth(synthAddress);
  });

  before('set skew scale to 1000 snxETH', async () => {
    await systems().SpotMarket.connect(marketOwner).setMarketSkewScale(marketId(), bn(1000));
  });

  const restore = snapshotCheckpoint(provider);

  let boughtSynth: Ethers.BigNumber;

  describe('neutral buy sell', () => {
    describe('buy', () => {
      before('buy $10000 worth', async () => {
        await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(10_000));
        await systems()
          .SpotMarket.connect(trader1)
          .buyExactIn(marketId(), bn(10_000), bn(9.5), Ethers.constants.AddressZero);
        boughtSynth = await synth.balanceOf(trader1.getAddress());
      });

      it('should have 9.9505ish snxETH', async () => {
        assertBn.near(boughtSynth, bn(9.9505), bn(0.0001));
      });
    });

    describe('sell', () => {
      let previousTrader1Balance: Ethers.BigNumber;
      before('sell all bought synth', async () => {
        previousTrader1Balance = await systems().USD.balanceOf(trader1.getAddress());
        await synth.connect(trader1).approve(systems().SpotMarket.address, boughtSynth);
        await systems()
          .SpotMarket.connect(trader1)
          .sellExactIn(marketId(), boughtSynth, 0, Ethers.constants.AddressZero);
      });

      it('should get back $10k (original investment)', async () => {
        assertBn.near(
          await systems().USD.balanceOf(trader1.getAddress()),
          previousTrader1Balance.add(bn(10000)),
          bn(0.001)
        );
      });
    });
  });

  describe('buy exact in and out', () => {
    before(restore);

    let startingTrader2Balance: Ethers.BigNumber;

    before('buy exact out', async () => {
      startingTrader2Balance = await systems().USD.balanceOf(trader2.getAddress());
      await systems().USD.connect(trader2).approve(systems().SpotMarket.address, bn(10_000));
      await systems()
        .SpotMarket.connect(trader2)
        .buyExactOut(marketId(), boughtSynth, bn(11_000), Ethers.constants.AddressZero);
    });

    it('should provide same amount of usd as when bought exact in', async () => {
      assertBn.near(
        await systems().USD.balanceOf(trader2.getAddress()),
        startingTrader2Balance.sub(bn(10000)),
        bn(0.0001)
      );
    });
  });

  describe('sell exact out', () => {
    before(restore);

    let startingSynthBalance: Ethers.BigNumber;

    before('buy', async () => {
      await systems().USD.connect(trader2).approve(systems().SpotMarket.address, bn(10_000));
      await systems()
        .SpotMarket.connect(trader2)
        .buyExactIn(marketId(), bn(10_000), 0, Ethers.constants.AddressZero);
      startingSynthBalance = await synth.balanceOf(trader2.getAddress());
    });

    before('sell exactly $10000 worth', async () => {
      await synth.connect(trader2).approve(systems().SpotMarket.address, startingSynthBalance);
      await systems()
        .SpotMarket.connect(trader2)
        .sellExactOut(marketId(), bn(10_000), bn(15), Ethers.constants.AddressZero);
    });

    it('should provide same amount of usd as when bought exact in', async () => {
      assertBn.near(await synth.balanceOf(trader2.getAddress()), 0, bn(0.0001));
    });
  });
});
