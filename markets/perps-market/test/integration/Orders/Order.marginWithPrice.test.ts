import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { bn, bootstrapMarkets } from '../bootstrap';
import {
  calculateFillPrice,
  openPosition,
  requiredMargins,
  getRequiredLiquidationRewardMargin,
} from '../helpers';
import { wei } from '@synthetixio/wei';
import { ethers } from 'ethers';

const MIN_LIQUIDATION_REWARD = wei(100);
const BTC_MARKET_PRICE = wei(10_000);
const ETH_MARKET_PRICE = wei(2000);
const BTC_MARKET_ID = 50;
const ETH_MARKET_ID = 51;
const BTC_SKEW_SCALE = 1000;
const ETH_SKEW_SCALE = 10_000;
const TRADER_ID = 2;

describe('Orders - margin withPrice calculation', () => {
  const liqParams = {
    btc: {
      imRatio: wei(0.02),
      minIm: wei(0.01),
      mmScalar: wei(0.5),
      liqRatio: wei(0.0075),
    },
    eth: {
      imRatio: wei(0.02),
      minIm: wei(0.01),
      mmScalar: wei(0.5),
      liqRatio: wei(0.01),
    },
  };
  const liqGuards = {
    minLiquidationReward: wei(MIN_LIQUIDATION_REWARD),
    minKeeperProfitRatioD18: wei(0),
    maxLiquidationReward: wei(10_000),
    maxKeeperScalingRatioD18: wei(1000),
  };
  const steps = [
    {
      name: 'with no positions opened',
      margin: 100,
      marginDelta: 100,
      current: { btc: { size: 0, skew: 0 }, eth: { size: 0, skew: 0 } },
      delta: { btc: { size: 0 }, eth: { size: 3 } },
    },
    {
      name: 'with one position opened (one market)',
      margin: 200,
      marginDelta: 1100,
      current: { btc: { size: 0, skew: 0 }, eth: { size: 3, skew: 3 } },
      delta: { btc: { size: 5 }, eth: { size: 0 } },
    },
    {
      name: 'with two positions opened (two markets)',
      margin: 1300,
      marginDelta: 0,
      current: { btc: { size: 5, skew: 5 }, eth: { size: 3, skew: 3 } },
      delta: { btc: { size: 0 }, eth: { size: 1 } },
    },
  ];

  const { systems, provider, trader1, perpsMarkets, keeper } = bootstrapMarkets({
    synthMarkets: [],
    liquidationGuards: {
      minLiquidationReward: liqGuards.minLiquidationReward.bn,
      minKeeperProfitRatioD18: liqGuards.minKeeperProfitRatioD18.bn,
      maxLiquidationReward: liqGuards.maxLiquidationReward.bn,
      maxKeeperScalingRatioD18: liqGuards.maxKeeperScalingRatioD18.bn,
    },
    perpsMarkets: [
      {
        requestedMarketId: BTC_MARKET_ID,
        name: 'Bitcoin',
        token: 'BTC',
        price: BTC_MARKET_PRICE.toBN(),
        fundingParams: { skewScale: bn(BTC_SKEW_SCALE), maxFundingVelocity: bn(0) },
        liquidationParams: {
          initialMarginFraction: liqParams.btc.imRatio.toBN(),
          minimumInitialMarginRatio: liqParams.btc.minIm.toBN(),
          maintenanceMarginScalar: liqParams.btc.mmScalar.toBN(),
          maxLiquidationLimitAccumulationMultiplier: bn(1),
          liquidationRewardRatio: liqParams.btc.liqRatio.toBN(),
          maxSecondsInLiquidationWindow: ethers.BigNumber.from(10),
          minimumPositionMargin: bn(0),
        },
        settlementStrategy: {
          settlementReward: bn(0),
        },
      },
      {
        requestedMarketId: ETH_MARKET_ID,
        name: 'Ether',
        token: 'ETH',
        price: ETH_MARKET_PRICE.toBN(),
        fundingParams: { skewScale: bn(ETH_SKEW_SCALE), maxFundingVelocity: bn(0) },
        liquidationParams: {
          initialMarginFraction: liqParams.eth.imRatio.toBN(),
          minimumInitialMarginRatio: liqParams.eth.minIm.toBN(),
          maintenanceMarginScalar: liqParams.eth.mmScalar.toBN(),
          maxLiquidationLimitAccumulationMultiplier: bn(1),
          liquidationRewardRatio: liqParams.eth.liqRatio.toBN(),
          maxSecondsInLiquidationWindow: ethers.BigNumber.from(10),
          minimumPositionMargin: bn(0),
        },
        settlementStrategy: {
          settlementReward: bn(0),
        },
      },
    ],
    traderAccountIds: [TRADER_ID],
  });

  async function requiredMarginForOrder({
    index,
    price,
    updatedMarket,
  }: {
    index: number;
    price: number;
    updatedMarket: string;
  }) {
    const step = steps[index];

    let orderFees, orderFillPrice, fillPrice, ethPrice, btcPrice;

    if (updatedMarket === 'eth') {
      [orderFees, orderFillPrice] = await systems().PerpsMarket.computeOrderFeesWithPrice(
        ETH_MARKET_ID,
        wei(step.delta.eth.size).bn,
        wei(price).bn
      );

      fillPrice = calculateFillPrice(
        wei(step.current.eth.skew),
        wei(ETH_SKEW_SCALE),
        wei(step.delta.eth.size),
        wei(price)
      );

      assertBn.equal(orderFillPrice, fillPrice.bn);

      ethPrice = fillPrice;
      btcPrice = wei(BTC_MARKET_PRICE);
    } else {
      [orderFees, orderFillPrice] = await systems().PerpsMarket.computeOrderFeesWithPrice(
        BTC_MARKET_ID,
        wei(step.delta.btc.size).bn,
        wei(price).bn
      );

      fillPrice = calculateFillPrice(
        wei(step.current.btc.skew),
        wei(BTC_SKEW_SCALE),
        wei(step.delta.btc.size),
        wei(price)
      );

      assertBn.equal(orderFillPrice, fillPrice.bn);

      ethPrice = wei(ETH_MARKET_PRICE);
      btcPrice = fillPrice;
    }

    const { initialMargin: ethInitialMargin, liquidationMargin: ethLiqMargin } = requiredMargins(
      {
        initialMarginRatio: liqParams.eth.imRatio,
        minimumInitialMarginRatio: liqParams.eth.minIm,
        maintenanceMarginScalar: liqParams.eth.mmScalar,
        liquidationRewardRatio: liqParams.eth.liqRatio,
      },
      wei(step.current.eth.size + step.delta.eth.size),
      ethPrice,
      wei(ETH_SKEW_SCALE)
    );

    const { initialMargin: btcInitialMargin, liquidationMargin: btcLiqMargin } = requiredMargins(
      {
        initialMarginRatio: liqParams.btc.imRatio,
        minimumInitialMarginRatio: liqParams.btc.minIm,
        maintenanceMarginScalar: liqParams.btc.mmScalar,
        liquidationRewardRatio: liqParams.btc.liqRatio,
      },
      wei(step.current.btc.size + step.delta.btc.size),
      btcPrice,
      wei(BTC_SKEW_SCALE)
    );

    const liqReward = getRequiredLiquidationRewardMargin(
      ethLiqMargin.add(btcLiqMargin),
      liqGuards,
      {
        costOfTx: wei(0),
        margin: wei(step.margin),
      }
    );

    const totalRequiredMargin = ethInitialMargin
      .add(btcInitialMargin)
      .add(liqReward)
      .add(orderFees);

    return totalRequiredMargin.toBN();
  }

  before('add margin to account', async () => {
    await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(100));
  });

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    describe(`step ${i + 1} - ${step.name}`, () => {
      it('gets the right required margin for different prices', async () => {
        let updatedMarket = '';
        let basePrice = 0;
        let marketId = 0;
        let deltaSize = 0;

        if (step.delta.btc.size !== 0) {
          // use btc market
          updatedMarket = 'btc';
          basePrice = 10000;
          marketId = BTC_MARKET_ID;
          deltaSize = step.delta.btc.size;
        } else if (step.delta.eth.size !== 0) {
          // use eth market
          updatedMarket = 'eth';
          basePrice = 2000;
          marketId = ETH_MARKET_ID;
          deltaSize = step.delta.eth.size;
        } else {
          // no changes
          return;
        }

        let price = basePrice;

        assertBn.equal(
          await systems().PerpsMarket.requiredMarginForOrderWithPrice(
            TRADER_ID,
            marketId,
            bn(deltaSize),
            bn(price)
          ),
          await requiredMarginForOrder({
            index: i,
            price,
            updatedMarket,
          })
        );

        price = basePrice / 2;
        assertBn.equal(
          await systems().PerpsMarket.requiredMarginForOrderWithPrice(
            TRADER_ID,
            marketId,
            bn(deltaSize),
            bn(price)
          ),
          await requiredMarginForOrder({
            index: i,
            price,
            updatedMarket,
          })
        );

        price = basePrice * 2;
        assertBn.equal(
          await systems().PerpsMarket.requiredMarginForOrderWithPrice(
            TRADER_ID,
            marketId,
            bn(deltaSize),
            bn(price)
          ),
          await requiredMarginForOrder({
            index: i,
            price,
            updatedMarket,
          })
        );
      });

      if (step.marginDelta !== 0) {
        it('add margin to account', async () => {
          await systems()
            .PerpsMarket.connect(trader1())
            .modifyCollateral(TRADER_ID, 0, bn(step.marginDelta));
        });
      }

      if (step.delta.btc.size !== 0) {
        it('open position', async () => {
          // open btc position
          await openPosition({
            systems,
            provider,
            trader: trader1(),
            accountId: TRADER_ID,
            keeper: keeper(),
            marketId: perpsMarkets()[0].marketId(),
            sizeDelta: bn(step.delta.btc.size),
            settlementStrategyId: perpsMarkets()[0].strategyId(),
            price: BTC_MARKET_PRICE.bn,
          });

          // check it's opened
          const [, , positionSize] = await systems().PerpsMarket.getOpenPosition(
            TRADER_ID,
            BTC_MARKET_ID
          );
          assertBn.equal(positionSize, bn(step.delta.btc.size + step.current.btc.size));
        });
      }

      if (step.delta.eth.size !== 0) {
        it('open position', async () => {
          // open eth position
          await openPosition({
            systems,
            provider,
            trader: trader1(),
            accountId: TRADER_ID,
            keeper: keeper(),
            marketId: perpsMarkets()[1].marketId(),
            sizeDelta: bn(step.delta.eth.size),
            settlementStrategyId: perpsMarkets()[1].strategyId(),
            price: ETH_MARKET_PRICE.bn,
          });

          // check it's opened
          const [, , positionSize] = await systems().PerpsMarket.getOpenPosition(
            TRADER_ID,
            ETH_MARKET_ID
          );
          assertBn.equal(positionSize, bn(step.delta.eth.size + step.current.eth.size));
        });
      }
    });
  }
});
