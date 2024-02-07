import { ethers } from 'ethers';
import {
  DEFAULT_SETTLEMENT_STRATEGY,
  PerpsMarket,
  bn,
  bootstrapMarkets,
} from '../../integration/bootstrap';
import { openPosition, getQuantoPositionSize } from '../../integration/helpers';
import Wei, { wei } from '@synthetixio/wei';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';

const _SECONDS_IN_DAY = 24 * 60 * 60;

const _SKEW_SCALE = bn(10_000);
const _MAX_FUNDING_VELOCITY = bn(3);
const _TRADER_SIZE = bn(20);
const _ETH_PRICE = bn(2000);
const _BTC_PRICE = bn(20_000);

describe.only('Position - funding', () => {
  const traderAccountIds = [2, 3];
  const trader1AccountId = traderAccountIds[0];
  const trader2AccountId = traderAccountIds[1];
  const { systems, perpsMarkets, synthMarkets, provider, trader1, trader2, keeper } =
    bootstrapMarkets({
      synthMarkets: [
        {
          name: 'Bitcoin',
          token: 'sBTC',
          buyPrice: _BTC_PRICE,
          sellPrice: _BTC_PRICE,
        },
      ],
      perpsMarkets: [
        {
          requestedMarketId: 25,
          name: 'Ether',
          token: 'snxETH',
          price: _ETH_PRICE,
          fundingParams: { skewScale: _SKEW_SCALE.div(20_000), maxFundingVelocity: bn(3) },
          quanto: {
            name: 'Bitcoin',
            token: 'BTC',
            price: _BTC_PRICE,
            quantoSynthMarketIndex: 0,
          },
        },
      ],
      traderAccountIds,
    });

  let ethMarket: PerpsMarket;
  before('identify actors', async () => {
    ethMarket = perpsMarkets()[0];
  });

  const trader1BTCMargin = bn(2.5);
  before('trader1 buys 2.5 sBTC', async () => {
    const btcSpotMarketId = synthMarkets()[0].marketId();
    const usdAmount = _BTC_PRICE.mul(trader1BTCMargin).div(ethers.utils.parseEther('1'));
    const minAmountReceived = trader1BTCMargin;
    const referrer = ethers.constants.AddressZero;
    await systems()
      .SpotMarket.connect(trader1())
      .buy(btcSpotMarketId, usdAmount, minAmountReceived, referrer);
  });

  const trader2BTCMargin = bn(50);
  before('trader2 buys 50 sBTC', async () => {
    const btcSpotMarketId = synthMarkets()[0].marketId();
    const usdAmount = _BTC_PRICE.mul(trader2BTCMargin).div(ethers.utils.parseEther('1'));
    const minAmountReceived = trader2BTCMargin;
    const referrer = ethers.constants.AddressZero;
    await systems()
      .SpotMarket.connect(trader2())
      .buy(btcSpotMarketId, usdAmount, minAmountReceived, referrer);
  });

  before('add sBTC collateral to margin', async () => {
    const btcSpotMarketId = synthMarkets()[0].marketId();
    // approve amount of collateral to be transfered to the market
    await synthMarkets()[0]
      .synth()
      .connect(trader1())
      .approve(systems().PerpsMarket.address, ethers.constants.MaxUint256);
    await synthMarkets()[0]
      .synth()
      .connect(trader2())
      .approve(systems().PerpsMarket.address, ethers.constants.MaxUint256);

    // trader accruing funding (deposits 2.5 btc worth $50k)
    await systems()
      .PerpsMarket.connect(trader1())
      .modifyCollateral(trader1AccountId, btcSpotMarketId, trader1BTCMargin);

    // trader moving skew (deposits 50 btc worth $1m)
    await systems()
      .PerpsMarket.connect(trader2())
      .modifyCollateral(trader2AccountId, btcSpotMarketId, trader1BTCMargin);
  });

  before('set Pyth Benchmark Price data', async () => {
    // set Pyth setBenchmarkPrice
    await systems().MockPythERC7412Wrapper.setBenchmarkPrice(_ETH_PRICE);
  });

  let openPositionTime: number;
  before('open 20 eth position', async () => {
    const positionSize = getQuantoPositionSize({
      sizeInBaseAsset: _TRADER_SIZE,
      quantoAssetPrice: _BTC_PRICE,
    });
    ({ settleTime: openPositionTime } = await openPosition({
      systems,
      provider,
      trader: trader1(),
      accountId: 2,
      keeper: keeper(),
      marketId: ethMarket.marketId(),
      sizeDelta: positionSize,
      settlementStrategyId: ethMarket.strategyId(),
      price: _ETH_PRICE,
      skipSettingPrice: true,
    }));
  });

  // it.only('magic', async () => {
  //   await fastForwardTo(
  //     openPositionTime -
  //       // this enables the market summary check to be as close as possible to the settlement time
  //       (DEFAULT_SETTLEMENT_STRATEGY.settlementDelay - 1) + // settlement strategy delay accounted for
  //       _SECONDS_IN_DAY * 7,
  //     provider()
  //   );
  //   const { accruedFunding } = await systems().PerpsMarket.getOpenPosition(
  //     2,
  //     ethMarket.marketId()
  //     );
  //   console.log('accruedFunding :', accruedFunding);
  //   console.log('here');
  // });

  /*
    +------------------------------------------------------------------------------------------+
    | Days elapsed |   Time   | Δ Skew | Skew | FR Velocity |    FR    | Accrued Funding (USD) |
    +------------------------------------------------------------------------------------------+
    |      0       |    0     |   0    |  20  |    0.006    |    0     |          0            |
    |      1       |  86400   |  -60   | -40  |    -0.012   |  0.006   |         120           |
    |      1       | 172800   |   15   | -25  |   -0.0075   |  -0.006  |         120           |
    |     0.25     | 194400   |   37   |  12  |    0.0036   | -0.007875|        50.625         |
    |      2       | 367200   |  -17   |  -5  |   -0.0015   | -0.000675|       -291.375        |
    |     0.2      | 384480   |  155   | 150  |    0.045    | -0.000975|       -297.975        |
    |     0.1      | 393120   | -150   |   0  |      0      | 0.003525 |       -292.875        |
    |     0.1      | 401760   |  -15   | -15  |   -0.0045   | 0.003525 |       -278.775        |
    |     0.03     | 404352   |   -4   | -19  |   -0.0057   |  0.00339 |       -274.626        |
    |      3       | 663552   |   19   |   0  |      0      | -0.01371 |       -893.826        |
    +------------------------------------------------------------------------------------------+
  */

  [
    { daysElapsed: 1, newOrderSize: bn(-60) },
    { daysElapsed: 1, newOrderSize: bn(15) },
    { daysElapsed: 0.25, newOrderSize: bn(37) },
    { daysElapsed: 2, newOrderSize: bn(-17) },
    { daysElapsed: 0.2, newOrderSize: bn(155) },
    { daysElapsed: 0.1, newOrderSize: bn(-150) },
    { daysElapsed: 0.1, newOrderSize: bn(-15) },
    { daysElapsed: 0.03, newOrderSize: bn(-4) },
    { daysElapsed: 3, newOrderSize: bn(19) },
  ].reduce(
    (
      {
        prevFrVelocity,
        prevFundingRate,
        prevAccruedFunding,
        prevSkew,
        accDaysElapsed,
        prevFrVelocityClassic,
        prevFundingRateClassic,
        prevAccruedFundingClassic,
        prevSkewClassic,
      },
      { daysElapsed, newOrderSize }
    ) => {
      const newQuantoOrderSize = getQuantoPositionSize({
        sizeInBaseAsset: newOrderSize,
        quantoAssetPrice: _BTC_PRICE,
      });
      accDaysElapsed += daysElapsed;

      // ACCRUED QUANTO FUNDING CALC ----------------------------------------------
      const currentSkew = prevSkew.add(newQuantoOrderSize);
      const frVelocity = wei(currentSkew).div(_SKEW_SCALE).mul(_MAX_FUNDING_VELOCITY);
      const fundingRate = prevFrVelocity.mul(daysElapsed).add(prevFundingRate);
      const expectedAccruedFunding = Wei.avg(wei(prevFundingRate), wei(fundingRate))
        .mul(_TRADER_SIZE)
        .mul(_ETH_PRICE)
        .mul(daysElapsed)
        .add(prevAccruedFunding);
      // END ACCRUED QUANTO FUNDING CALC -------------------------------------------

      // ACCRUED Classic FUNDING CALC ----------------------------------------------
      const currentSkewClassic = prevSkewClassic.add(newOrderSize);
      const frVelocityClassic = wei(currentSkewClassic).div(_SKEW_SCALE).mul(_MAX_FUNDING_VELOCITY);
      const fundingRateClassic = prevFrVelocityClassic.mul(daysElapsed).add(prevFundingRateClassic);
      const expectedAccruedFundingClassic = Wei.avg(
        wei(prevFundingRateClassic),
        wei(fundingRateClassic)
      )
        .mul(_TRADER_SIZE)
        .mul(_ETH_PRICE)
        .mul(daysElapsed)
        .add(prevAccruedFundingClassic);
      // END Classic QUANTO FUNDING CALC -------------------------------------------

      describe(`after ${daysElapsed} days`, () => {
        before('move time', async () => {
          await fastForwardTo(
            openPositionTime -
              // this enables the market summary check to be as close as possible to the settlement time
              (DEFAULT_SETTLEMENT_STRATEGY.settlementDelay - 1) + // settlement strategy delay accounted for
              _SECONDS_IN_DAY * accDaysElapsed,
            provider()
          );
        });

        before('trader2 moves skew', async () => {
          await openPosition({
            systems,
            provider,
            trader: trader2(),
            accountId: 3,
            keeper: trader2(),
            marketId: ethMarket.marketId(),
            sizeDelta: newQuantoOrderSize,
            settlementStrategyId: ethMarket.strategyId(),
            price: _ETH_PRICE,
            skipSettingPrice: true,
          });
        });

        it('funding accrued is correct', async () => {
          const { accruedFunding } = await systems().PerpsMarket.getOpenPosition(
            2,
            ethMarket.marketId()
          );
          const expectedAccruedFundingInUSD = expectedAccruedFunding.mul(20_000);

          // using negative value because trader pnl
          assertBn.equal(expectedAccruedFundingClassic.toBN(), expectedAccruedFundingInUSD.toBN());
          assertBn.near(accruedFunding, expectedAccruedFunding.mul(-1).toBN(), bn(0.1));
        });
      });

      return {
        prevFrVelocity: frVelocity,
        prevFundingRate: fundingRate,
        prevAccruedFunding: expectedAccruedFunding,
        prevSkew: currentSkew,
        accDaysElapsed,
        prevFrVelocityClassic: frVelocityClassic,
        prevFundingRateClassic: fundingRateClassic,
        prevAccruedFundingClassic: expectedAccruedFundingClassic,
        prevSkewClassic: currentSkewClassic,
      };
    },
    {
      prevFrVelocity: wei(0.006).div(_BTC_PRICE),
      prevFundingRate: wei(0),
      prevAccruedFunding: wei(0),
      prevSkew: wei(20).div(_BTC_PRICE),
      accDaysElapsed: 0,
      prevFrVelocityClassic: wei(0.006),
      prevFundingRateClassic: wei(0),
      prevAccruedFundingClassic: wei(0),
      prevSkewClassic: wei(20),
    }
  );
});
