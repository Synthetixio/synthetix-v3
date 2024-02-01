import { ethers } from 'ethers';
import { bn, bootstrapMarkets } from '../integration/bootstrap';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assert from 'assert/strict';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';

import { wei } from '@synthetixio/wei';
import { OpenPositionData, openPosition, getQuantoPnl, getQuantoPositionSize } from '../integration/helpers';

// NOTE: this is based on ModifyCollateral.withdraw.test.ts
const sUSDSynthId = 0;
describe.only('Quanto', () => {
  describe('withdraw with open positions', () => {
    const perpsMarketConfigs = [
      {
        requestedMarketId: 25,
        name: 'Bitcoin',
        token: 'BTC',
        price: bn(30_000),
        fundingParams: { skewScale: bn(0), maxFundingVelocity: bn(0) },
        liquidationParams: {
          initialMarginFraction: bn(2),
          minimumInitialMarginRatio: bn(0.01),
          maintenanceMarginScalar: bn(0.5),
          maxLiquidationLimitAccumulationMultiplier: bn(1),
          liquidationRewardRatio: bn(0.05),
          maxSecondsInLiquidationWindow: ethers.BigNumber.from(10),
          minimumPositionMargin: bn(0),
        },
        settlementStrategy: {
          settlementReward: bn(0),
        },
        quanto: {
          name: 'Ether',
          token: 'ETH',
          price: bn(2_000),
          quantoSynthMarketIndex: 0,
        },
      },
    ];

    // Used to ensure non snxUSD collateral works as expected
    const spotMarketConfig = [
      {
        name: 'Ether',
        token: 'snxETH',
        buyPrice: bn(2000),
        sellPrice: bn(2000),
      },
    ];
    const traderAccountIds = [2, 3];
    const trader1AccountId = traderAccountIds[0];
    const { systems, provider, trader1, perpsMarkets, synthMarkets } = bootstrapMarkets({
      synthMarkets: spotMarketConfig,
      perpsMarkets: perpsMarketConfigs,
      liquidationGuards: {
        minLiquidationReward: bn(0),
        minKeeperProfitRatioD18: bn(0),
        maxLiquidationReward: bn(10_000),
        maxKeeperScalingRatioD18: bn(1),
      },

      traderAccountIds,
    });
    const trader1ETHMargin = bn(10);
    before('trader1 buys 10 snxETH', async () => {
      const ethSpotMarketId = synthMarkets()[0].marketId();
      const usdAmount = bn(20_000);
      const minAmountReceived = trader1ETHMargin;
      const referrer = ethers.constants.AddressZero;
      await systems()
        .SpotMarket.connect(trader1())
        .buy(ethSpotMarketId, usdAmount, minAmountReceived, referrer);
    });
    before('add some stop ETH collateral to margin', async () => {
      const ethSpotMarketId = synthMarkets()[0].marketId();
      // approve amount of collateral to be transfered to the market
      await synthMarkets()[0]
        .synth()
        .connect(trader1())
        .approve(systems().PerpsMarket.address, ethers.constants.MaxUint256);
      await systems()
        .PerpsMarket.connect(trader1())
        .modifyCollateral(trader1AccountId, ethSpotMarketId, trader1ETHMargin);
    });

    let commonOpenPositionProps: Pick<
      OpenPositionData,
      'systems' | 'provider' | 'trader' | 'accountId' | 'keeper'
    >;
    before('identify common props', async () => {
      commonOpenPositionProps = {
        systems,
        provider,
        trader: trader1(),
        accountId: 2,
        keeper: trader1(),
      };
    });
    before('open positions', async () => {
      // 2 BTC long position
      const posSize = getQuantoPositionSize({
        sizeInBaseAsset: 2,
        quantoAssetPrice: 2_000
      });
      const positionSizes = [
        bn(posSize),
      ];

      await openPosition({
        ...commonOpenPositionProps,
        marketId: perpsMarkets()[0].marketId(),
        sizeDelta: positionSizes[0],
        settlementStrategyId: perpsMarkets()[0].strategyId(),
        price: perpsMarketConfigs[0].price,
      });
    });
    describe('account check after initial positions open', () => {
      it('has correct quanto market id', async () => {
        const ethSpotMarketId = synthMarkets()[0].marketId();
        const btcPerpsMarketId = perpsMarkets()[0].marketId();
        assertBn.equal(
          await systems().PerpsMarket.getQuantoSynthMarket(btcPerpsMarketId),
          ethSpotMarketId
        );
      });
      it('has quanto feed id set', async () => {
        const btcPerpsMarketId = perpsMarkets()[0].marketId();
        const quantoFeedId = await systems().PerpsMarket.getQuantoFeedId(btcPerpsMarketId);
        assert(quantoFeedId.length > 0);
      });
      it('should have correct open interest', async () => {
        const expectedOi = 60_000; // 2 BTC * 30k
        assertBn.equal(
          await systems().PerpsMarket.totalAccountOpenInterest(trader1AccountId),
          bn(expectedOi)
        );
      });
      it('has no pnl, given skewScale is set to zero', async () => {
        const [btcPnl] = await systems().PerpsMarket.getOpenPosition(
          trader1AccountId,
          perpsMarkets()[0].marketId()
        );
        assertBn.equal(btcPnl, 0);
      });
      it('has correct available margin', async () => {
        assertBn.equal(
          await systems().PerpsMarket.getAvailableMargin(trader1AccountId),
          bn(20_000) // collateral value  + pnl =  20000 + 0
        );
      });
    });
    describe('allow withdraw when its less than collateral available for withdraw', () => {
      const restore = snapshotCheckpoint(provider);

      let initialMarginReq: ethers.BigNumber;

      before('withdraw allowed amount', async () => {
        const ethSpotMarketId = synthMarkets()[0].marketId();

        [initialMarginReq] = await systems()
          .PerpsMarket.connect(trader1())
          .getRequiredMargins(trader1AccountId);
        // available margin = collateral value + pnl = $19000
        const withdrawAmt = bn(20_000).sub(initialMarginReq).mul(-1).div(2000);

        await systems()
          .PerpsMarket.connect(trader1())
          .modifyCollateral(trader1AccountId, ethSpotMarketId, withdrawAmt);
      });
      after(restore);

      it('has correct available margin', async () => {
        assertBn.equal(
          await systems().PerpsMarket.getAvailableMargin(trader1AccountId),
          initialMarginReq
        );
      });
    });
    describe('pnl adjusts correctly', () => {
      before('check initial margin is as expected', async () => {
        assertBn.equal(
          await systems().PerpsMarket.getAvailableMargin(trader1AccountId),
          bn(2_000).mul(10)
        );
      });
      before('btc pumps', async () => {
        await perpsMarkets()[0].aggregator().mockSetCurrentPrice(bn(40_000));
      });

      before('eth pumps', async () => {
        // TODO: adjust bootstrap so that the same aggregator/oracle is used for the spot market and the perps market
        // update eth price on perps market (effects USD pnl)
        await perpsMarkets()[0].quantoAggregator().mockSetCurrentPrice(bn(4_000));
        // update eth price on synth market (effects collateral value)
        await synthMarkets()[0].sellAggregator().mockSetCurrentPrice(bn(4_000));
      });

      it('does not have the amount of margin for a classic perps payout', async () => {
        const expectedCollateral = bn(4_000).mul(10); // $40k collateral
        const classicPnl = bn(10_000).mul(2); // $20k profit
        const classicPayoutMargin = expectedCollateral.add(classicPnl);

        // check the pnl
        const availableMargin = await systems().PerpsMarket.getAvailableMargin(trader1AccountId);
        assertBn.notEqual(availableMargin, classicPayoutMargin);
      });

      it('has correct margin based on quanto perps payout', async () => {
        const expectedCollateral = bn(4_000).mul(10); // $40k collateral

        const quantoPnl = getQuantoPnl({ // 10k * 2 * 2 = $40k profit
          baseAssetStartPrice: 30_000,
          baseAssetEndPrice: 40_000,
          quantoAssetStartPrice: 2_000,
          quantoAssetEndPrice: 4_000,
          baseAssetSizeDelta: 2,
        });

        const expectedMargin = expectedCollateral.add(bn(quantoPnl));

        // check the pnl
        const availableMargin = await systems().PerpsMarket.getAvailableMargin(trader1AccountId);
        assertBn.equal(availableMargin, expectedMargin);
      });

      it('trader can withdraw all his quanto margin and winnings as sUSD', async () => {
        const expectedCollateral = bn(4_000).mul(10); // $40k collateral

        const quantoPnl = getQuantoPnl({
          baseAssetStartPrice: 30_000,
          baseAssetEndPrice: 40_000,
          quantoAssetStartPrice: 2_000,
          quantoAssetEndPrice: 4_000,
          baseAssetSizeDelta: 2,
        });

        const withdrawAmt = expectedCollateral.add(bn(quantoPnl));

        const trader1Address = await trader1().getAddress();
        const balBeforeWithdraw = await systems().USD.connect(trader1()).balanceOf(trader1Address);

        await systems()
          .PerpsMarket.connect(trader1())
          .modifyCollateral(trader1AccountId, sUSDSynthId, withdrawAmt);

        const balAfterWithdraw = await systems().USD.connect(trader1()).balanceOf(trader1Address);
        assertBn.equal(balBeforeWithdraw.sub(balAfterWithdraw), withdrawAmt);
      });
    });
  });
});
