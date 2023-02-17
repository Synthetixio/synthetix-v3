import { ethers } from 'ethers';
import { bn, bootstrapTraders, bootstrapWithSynth } from '../bootstrap';
import { SynthRouter } from '../generated/typechain';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { fastForwardTo, getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';

describe('Multiple orders integration test', () => {
  const { systems, signers, marketId, provider } = bootstrapTraders(
    bootstrapWithSynth('Synthetic Ether', 'snxETH')
  );

  let marketOwner: ethers.Signer,
    trader1: ethers.Signer,
    trader2: ethers.Signer,
    synth: SynthRouter;

  before('identify', async () => {
    [, , marketOwner, trader1, trader2] = signers();

    const synthAddress = await systems().SpotMarket.getSynth(1);
    synth = systems().Synth(synthAddress);
  });

  before('add settlement strategy', async () => {
    await systems()
      .SpotMarket.connect(marketOwner)
      .addSettlementStrategy(marketId(), {
        strategyType: 0,
        settlementDelay: 5,
        settlementWindowDuration: 120,
        priceVerificationContract: ethers.constants.AddressZero,
        feedId: ethers.constants.HashZero,
        url: '',
        settlementReward: 0, // make math easier
        priceDeviationTolerance: bn(0.01),
      });
  });

  before('setup fees', async () => {
    await systems().SpotMarket.connect(marketOwner).setAsyncFixedFee(marketId(), bn(0.005)); // 0.5%
    await systems().SpotMarket.connect(marketOwner).setAtomicFixedFee(marketId(), bn(0.01)); // 1%
    await systems().SpotMarket.connect(marketOwner).setMarketSkewScale(marketId(), bn(1000)); // 100 snxEth
    await systems().SpotMarket.connect(marketOwner).setMarketUtilizationFees(marketId(), bn(0.001)); // 0.1%
  });

  describe('commit 3 orders and settle one', () => {
    before('3 committed orders', async () => {
      await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(150_000));
      await systems().USD.connect(trader2).approve(systems().SpotMarket.address, bn(25_000));

      await systems()
        .SpotMarket.connect(trader1)
        .commitOrder(marketId(), 2, bn(100_000), 0, bn(80)); // order #1
      await systems().SpotMarket.connect(trader1).commitOrder(marketId(), 2, bn(50_000), 0, bn(30)); // order #2
      await systems().SpotMarket.connect(trader2).commitOrder(marketId(), 2, bn(25_000), 0, bn(15)); // order #3
    });

    before('settle order #3', async () => {
      await fastForwardTo((await getTime(provider())) + 10, provider());
      await systems().SpotMarket.connect(marketOwner).settleOrder(marketId(), 3);
    });

    it('returned correct amount of synth to trader 2', async () => {
      // 150% prefill utilization, 175% postfill utilization
      // 150 eth skew prefill, 175 eth skew postfill
      // 0.05% fixed fee
      // 25000-(25000*(0.005+0.0625(skew)+0.1625(util)))
      assertBn.equal(await synth.balanceOf(await trader2.getAddress()), bn(19.25));
    });
  });

  // making sure wrapped collateral is taken into account when calculating fees
  describe('wrap collateral', () => {
    before('enable wrapper', async () => {
      await systems()
        .SpotMarket.connect(marketOwner)
        .setWrapper(marketId(), systems().CollateralMock.address, bn(500));
    });

    before('wrap collateral', async () => {
      await systems().CollateralMock.connect(trader1).approve(systems().SpotMarket.address, bn(10));
      await systems().SpotMarket.connect(trader1).wrap(marketId(), bn(10));
    });

    it('trader receives 1 snxETH', async () => {
      assertBn.equal(await synth.balanceOf(await trader1.getAddress()), bn(10));
    });
  });

  describe('atomic buy comes in', () => {
    let previousTrader1Balance: ethers.BigNumber;
    before('atomic buy', async () => {
      previousTrader1Balance = await synth.balanceOf(await trader1.getAddress());
      await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(10_000));
      await systems().SpotMarket.connect(trader1).buy(marketId(), bn(10_000), bn(7));
    });

    it('trader receives correct snxETH', async () => {
      // 150_000 USD committed
      // 10_000 USD wrapped
      // 19_250 USD outstanding synth from sale
      // 179_250 USD total outstanding

      // atomic fixed fee = 1%
      // Note: skew removes wrapped collateral from calculation so using 169.25
      // skew for skewscale 1000 = (.16925 + .17925) / 2 = .17425 = 17.425%
      // utilization (100 eth) = (79.25 + 89.25) / 2 = 84.25 * util rate (0.1) = 8.425%

      // total fees = 26.85%
      assertBn.equal(
        await synth.balanceOf(await trader1.getAddress()),
        previousTrader1Balance.add(bn(7.315))
      );
    });
  });

  describe('one of the buy orders from initial commit settles', () => {
    let previousTrader1Balance: ethers.BigNumber;
    before('settle order #1', async () => {
      previousTrader1Balance = await synth.balanceOf(await trader1.getAddress());
      await fastForwardTo((await getTime(provider())) + 10, provider());
      await systems().SpotMarket.connect(marketOwner).settleOrder(marketId(), 1);
    });

    it('trader receives 1 snxETH', async () => {
      // 50_000 USD committed (order #2)
      // 10_000 USD wrapped
      // 19_250 + 7_315 USD = 26_565 outstanding synth from sales
      // 86_565 USD total outstanding

      // async fixed fee = 0.5%
      // skew for skewscale 1000 = (.076565 + .176565) / 2 = 0.126565 = 12.6565%
      // utilization (100 eth) = (0 under util before + 86.565) / 2
      //    = 43.2825 * util rate(0.1) = 4.32825 %

      // total fees = 17.48475%
      assertBn.equal(
        await synth.balanceOf(await trader1.getAddress()),
        previousTrader1Balance.add(bn(82.51525))
      );
    });
  });

  describe('commit and settle sell order', () => {
    let traderBalance: ethers.BigNumber;
    before('commit sell order', async () => {
      traderBalance = await systems().USD.balanceOf(await trader1.getAddress());
      await synth.connect(trader1).approve(systems().SpotMarket.address, bn(10));
      await systems().SpotMarket.connect(trader1).commitOrder(marketId(), 3, bn(10), 0, bn(10_000));
    });

    before('settle sell order', async () => {
      await fastForwardTo((await getTime(provider())) + 10, provider());
      await systems().SpotMarket.connect(marketOwner).settleOrder(marketId(), 4);
    });

    it('trader receives correct snxUSD', async () => {
      // sell = $900/eth
      // 50_000 USD committed (order #2)
      // 10_000 USD wrapped
      // 19.25 * 900 (17_325) + 7.315 * 900 (6583.5) + 82.51525 * 900 (74,263.725)
      //  = $98,172.225 value synth exposure
      // $148,172.225 USD total outstanding (without wrapped collateral)

      // async fixed fee = 0.5%
      // skew scale = 900_000
      // skew for skewscale 1000 = (0.164635805556 + .154635805556) / 2 = 0.1596358056
      //    = -15.96358056 %
      // utilization = 0; none on sell

      // total fees = -15.46358056%
      assertBn.near(
        await systems().USD.balanceOf(await trader1.getAddress()),
        traderBalance.add(bn(10391.72)),
        bn(0.01)
      );
    });
  });
});
