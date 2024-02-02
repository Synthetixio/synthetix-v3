import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { ethers as Ethers } from 'ethers';
import { bn, bootstrapTraders, bootstrapWithSynth } from '../bootstrap';
import { SynthRouter } from '../generated/typechain';

describe('testing skew', () => {
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

  before('unlimited approval', async () => {
    await systems()
      .USD.connect(trader1)
      .approve(systems().SpotMarket.address, Ethers.constants.MaxUint256);
    await systems()
      .USD.connect(trader2)
      .approve(systems().SpotMarket.address, Ethers.constants.MaxUint256);
    await synth.connect(trader1).approve(systems().SpotMarket.address, Ethers.constants.MaxUint256);
    await synth.connect(trader2).approve(systems().SpotMarket.address, Ethers.constants.MaxUint256);
  });

  const restore = snapshotCheckpoint(provider);

  let boughtSynth: Ethers.BigNumber;

  describe('neutral buy sell', () => {
    describe('buy', () => {
      before('buy $10000 worth', async () => {
        await systems()
          .SpotMarket.connect(trader1)
          .buyExactIn(marketId(), bn(10_000), bn(9.5), Ethers.constants.AddressZero);
        boughtSynth = await synth.balanceOf(await trader1.getAddress());
      });

      it('should have 9.9505ish snxETH', async () => {
        assertBn.near(boughtSynth, bn(9.9505), bn(0.0001));
      });

      it('market should have 9.9505ish skew', async () => {
        assertBn.near(await systems().SpotMarket.getMarketSkew(marketId()), bn(9.9505), bn(0.0001));
      });
    });

    describe('sell', () => {
      let previousTrader1Balance: Ethers.BigNumber;
      before('sell all bought synth', async () => {
        previousTrader1Balance = await systems().USD.balanceOf(await trader1.getAddress());
        await systems()
          .SpotMarket.connect(trader1)
          .sellExactIn(marketId(), boughtSynth, 0, Ethers.constants.AddressZero);
      });

      it('should get back $10k (original investment)', async () => {
        assertBn.near(
          await systems().USD.balanceOf(await trader1.getAddress()),
          previousTrader1Balance.add(bn(10000)),
          bn(0.001)
        );
      });

      it('market should have 0 skew', async () => {
        assertBn.equal(await systems().SpotMarket.getMarketSkew(marketId()), bn(0));
      });
    });
  });

  describe('buy exact in and out', () => {
    before(restore);

    let startingTrader2Balance: Ethers.BigNumber;

    before('buy exact out', async () => {
      startingTrader2Balance = await systems().USD.balanceOf(await trader2.getAddress());
      await systems()
        .SpotMarket.connect(trader2)
        .buyExactOut(marketId(), boughtSynth, bn(11_000), Ethers.constants.AddressZero);
    });

    it('should provide same amount of usd as when bought exact in', async () => {
      assertBn.near(
        await systems().USD.balanceOf(await trader2.getAddress()),
        startingTrader2Balance.sub(bn(10000)),
        bn(0.0001)
      );
    });

    it('market should have 0 skew', async () => {
      assertBn.equal(await systems().SpotMarket.getMarketSkew(marketId()), boughtSynth);
    });
  });

  describe('buy path independence with fixed fee', () => {
    let synthBalance: Ethers.BigNumber, startingTrader2Balance: Ethers.BigNumber;

    describe('buy exact in', () => {
      before(restore);
      before('set atomic fee', async () => {
        await systems().SpotMarket.connect(marketOwner).setAtomicFixedFee(marketId(), bn(0.2));
      });

      before(async () => {
        await systems()
          .SpotMarket.connect(trader1)
          .buyExactIn(marketId(), bn(10_000), bn(0), Ethers.constants.AddressZero);
        synthBalance = await synth.balanceOf(await trader1.getAddress());
      });

      it('has correct synth balance', async () => {
        assertBn.near(await synth.balanceOf(await trader1.getAddress()), bn(7.96825), bn(0.0001));
      });

      it('market should have 0 skew', async () => {
        assertBn.near(
          await systems().SpotMarket.getMarketSkew(marketId()),
          bn(7.96825),
          bn(0.0001)
        );
      });
    });

    describe('buy exact out', () => {
      before(restore);

      before('set atomic fee', async () => {
        await systems().SpotMarket.connect(marketOwner).setAtomicFixedFee(marketId(), bn(0.2));
      });

      before('buy exact out', async () => {
        startingTrader2Balance = await systems().USD.balanceOf(await trader2.getAddress());
        await systems()
          .SpotMarket.connect(trader2)
          .buyExactOut(marketId(), synthBalance, bn(5000000), Ethers.constants.AddressZero);
      });

      it('should charge same amount as buy exact in', async () => {
        assertBn.near(
          await systems().USD.balanceOf(await trader2.getAddress()),
          startingTrader2Balance.sub(bn(10000)),
          bn(0.000001)
        );
      });

      it('market should have 0 skew', async () => {
        assertBn.equal(await systems().SpotMarket.getMarketSkew(marketId()), synthBalance);
      });
    });
  });

  describe('sell path indenpendent with fixed fee', () => {
    before(restore);

    before('buy 20 ETH exact', async () => {
      await systems()
        .SpotMarket.connect(trader1)
        .buyExactOut(marketId(), bn(20), bn(30000), Ethers.constants.AddressZero);
    });

    before('set atomic fee', async () => {
      await systems().SpotMarket.connect(marketOwner).setAtomicFixedFee(marketId(), bn(0.2));
    });

    // 20 ETH skew with fee set to 20%
    const restorePointForSell = snapshotCheckpoint(provider);

    let usdReceivedAfterFirstSell: Ethers.BigNumber;
    before('sell exact in', async () => {
      const initialTraderUsdBalance = await systems().USD.balanceOf(await trader1.getAddress());
      await systems()
        .SpotMarket.connect(trader1)
        .sellExactIn(marketId(), bn(10), bn(0), Ethers.constants.AddressZero);
      usdReceivedAfterFirstSell = (await systems().USD.balanceOf(await trader1.getAddress())).sub(
        initialTraderUsdBalance
      );
    });

    describe('sell exact out', () => {
      before(restorePointForSell);

      let startingSynthBalance: Ethers.BigNumber;

      before('sell exact out', async () => {
        startingSynthBalance = await synth.balanceOf(await trader1.getAddress());
        await systems()
          .SpotMarket.connect(trader1)
          .sellExactOut(
            marketId(),
            usdReceivedAfterFirstSell,
            Ethers.constants.MaxUint256,
            Ethers.constants.AddressZero
          );
      });

      it('should charge 10 eth', async () => {
        assertBn.near(
          await synth.balanceOf(await trader1.getAddress()),
          startingSynthBalance.sub(bn(10)),
          bn(0.0001)
        );
      });

      it('market should have 0 skew', async () => {
        assertBn.equal(await systems().SpotMarket.getMarketSkew(marketId()), bn(10));
      });
    });
  });
});
