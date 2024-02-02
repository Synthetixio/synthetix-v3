import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { ethers as Ethers } from 'ethers';
import { bn, bootstrapTraders, bootstrapWithSynth } from '../bootstrap';
import { SynthRouter } from '../generated/typechain';

describe('skew balance integration test', () => {
  const { systems, signers, marketId, provider, aggregator } = bootstrapTraders(
    bootstrapWithSynth('Synthetic Ether', 'snxETH')
  );

  let marketOwner: Ethers.Signer, trader1: Ethers.Signer;
  let synth: SynthRouter;

  before('identify actors', async () => {
    [, , marketOwner, trader1] = signers();
  });

  before('identify synth', async () => {
    const synthAddress = await systems().SpotMarket.getSynth(1);
    synth = systems().Synth(synthAddress);
  });

  before('set skew scale to 100 snxETH', async () => {
    await systems().SpotMarket.connect(marketOwner).setMarketSkewScale(marketId(), bn(100));
  });

  before('set sell price to $1000', async () => {
    await aggregator().mockSetCurrentPrice(bn(1000));
  });

  before('set wrapper', async () => {
    await systems()
      .SpotMarket.connect(marketOwner)
      .setWrapper(marketId(), systems().CollateralMock.address, bn(500));
  });

  it('should have 0 skew', async () => {
    assertBn.equal(await systems().SpotMarket.getMarketSkew(marketId()), bn(0));
  });

  const restore = snapshotCheckpoint(provider);

  describe('wrap and sell, negative skew', () => {
    before(restore);

    before('wrap', async () => {
      await systems().CollateralMock.connect(trader1).approve(systems().SpotMarket.address, bn(10));

      await systems().SpotMarket.connect(trader1).wrap(marketId(), bn(10), 0);
    });

    it('should have right skew', async () => {
      // wrapped 10 eth, minted 10 snxETH
      assertBn.equal(await systems().SpotMarket.getMarketSkew(marketId()), bn(0));
    });

    describe('sell', () => {
      let trader1UsdBalanceBeforeSell: Ethers.BigNumber;
      before('sell', async () => {
        trader1UsdBalanceBeforeSell = await systems().USD.balanceOf(await trader1.getAddress());
        await synth.connect(trader1).approve(systems().SpotMarket.address, bn(10));
        await systems()
          .SpotMarket.connect(trader1)
          .sell(marketId(), bn(10), bn(0), Ethers.constants.AddressZero);
      });

      it('should have right skew', async () => {
        // wrapped 10 eth, sold 10 snxETH => -10 skew
        assertBn.equal(await systems().SpotMarket.getMarketSkew(marketId()), bn(-10));
      });

      // selling 10 eth. should get extra $500 via skew fee
      it('$500 less returned', async () => {
        const afterTraderBalance = await systems().USD.balanceOf(await trader1.getAddress());
        assertBn.equal(afterTraderBalance, trader1UsdBalanceBeforeSell.add(bn(9_500)));
      });
    });

    describe('buy', () => {
      before('buy $9500', async () => {
        // $1000/eth
        await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(9_500));
        await systems()
          .SpotMarket.connect(trader1)
          .buy(marketId(), bn(9_500), bn(0), Ethers.constants.AddressZero);
      });

      it('should have right skew', async () => {
        // wrapped 10 eth, bought 10 snxETH => 0 skew
        assertBn.equal(await systems().SpotMarket.getMarketSkew(marketId()), bn(0));
      });

      it('trader1 should receive 10 eth', async () => {
        assertBn.equal(await synth.balanceOf(await trader1.getAddress()), bn(10));
      });
    });

    // selling from 0 eth skew to -X, so trader gets positive skew fee
    describe('sell exact out', () => {
      let usdReceived: Ethers.BigNumber;
      before('buy more', async () => {
        const initialTraderBalance = await systems().USD.balanceOf(await trader1.getAddress());
        await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(20_000));
        await systems()
          .SpotMarket.connect(trader1)
          .buyExactOut(marketId(), bn(10), bn(20_000), Ethers.constants.AddressZero);
        usdReceived = initialTraderBalance.sub(
          await systems().USD.balanceOf(await trader1.getAddress())
        );
      });

      before('sell', async () => {
        await synth.connect(trader1).approve(systems().SpotMarket.address, usdReceived);
        await systems()
          .SpotMarket.connect(trader1)
          .sellExactOut(marketId(), usdReceived, bn(12), Ethers.constants.AddressZero);
      });

      it('should have right skew', async () => {
        // wrapped 10 eth, bought amd sold same ammount (10 snxETH) => 0 skew
        assertBn.equal(await systems().SpotMarket.getMarketSkew(marketId()), bn(0));
      });

      it('trader1 should be charged more than 10 eth', async () => {
        assertBn.near(await synth.balanceOf(await trader1.getAddress()), bn(10), bn(0.0001));
      });
    });
  });

  describe('buy two $5000, sell all', () => {
    before(restore);

    before('buy multiple $5000', async () => {
      await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(5_000));
      await systems()
        .SpotMarket.connect(trader1)
        .buy(marketId(), bn(5_000), bn(0), Ethers.constants.AddressZero);

      await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(5_000));
      await systems()
        .SpotMarket.connect(trader1)
        .buy(marketId(), bn(5_000), bn(0), Ethers.constants.AddressZero);
    });

    let beforeSellUsdBalance: Ethers.BigNumber;

    before('sell all', async () => {
      beforeSellUsdBalance = await systems().USD.balanceOf(await trader1.getAddress());
      const synthTraderValue = await synth.balanceOf(await trader1.getAddress());

      await synth.connect(trader1).approve(systems().SpotMarket.address, synthTraderValue);
      await systems()
        .SpotMarket.connect(trader1)
        .sell(marketId(), synthTraderValue, bn(0), Ethers.constants.AddressZero);
    });

    it('should have right skew', async () => {
      // wrapped 10 eth, bought amd sold same ammount (10 snxETH) => 0 skew
      assertBn.equal(await systems().SpotMarket.getMarketSkew(marketId()), bn(0));
    });

    it('check synth balance of trader 1', async () => {
      const afterTraderUsd = await systems().USD.balanceOf(await trader1.getAddress());
      assertBn.near(afterTraderUsd.sub(beforeSellUsdBalance), bn(10_000), bn(0.0001));
    });
  });

  describe('buy $10,000, sell half and half', () => {
    before(restore);

    before('buy multiple $5000', async () => {
      await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(10_000));
      await systems()
        .SpotMarket.connect(trader1)
        .buy(marketId(), bn(10_000), bn(0), Ethers.constants.AddressZero);
    });

    let beforeSellUsd: Ethers.BigNumber;
    before('sell all', async () => {
      beforeSellUsd = await systems().USD.balanceOf(await trader1.getAddress());
      const synthTraderValue = await synth.balanceOf(await trader1.getAddress());

      await synth.connect(trader1).approve(systems().SpotMarket.address, synthTraderValue.div(2));
      await systems()
        .SpotMarket.connect(trader1)
        .sell(marketId(), synthTraderValue.div(2), bn(0), Ethers.constants.AddressZero);

      await synth.connect(trader1).approve(systems().SpotMarket.address, synthTraderValue.div(2));
      await systems()
        .SpotMarket.connect(trader1)
        .sell(marketId(), synthTraderValue.div(2), bn(0), Ethers.constants.AddressZero);
    });

    it('should have right skew', async () => {
      // wrapped 10 eth, bought amd sold same ammount (10 snxETH) => 0 skew
      // Note: using near with delta 1 due to div(2) rounding
      assertBn.near(await systems().SpotMarket.getMarketSkew(marketId()), bn(0), 1);
    });

    it('check synth balance of trader 1', async () => {
      const balanceAfterSells = await systems().USD.balanceOf(await trader1.getAddress());
      assertBn.near(balanceAfterSells.sub(beforeSellUsd), bn(10_000), bn(0.0001));
    });
  });
});
