import { DEFAULT_SETTLEMENT_STRATEGY, PerpsMarket, bn, bootstrapMarkets } from '../bootstrap';
import { ethers } from 'ethers';
import { openPosition } from '../helpers';
import Wei, { wei } from '@synthetixio/wei';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';

const _SECONDS_IN_DAY = 24 * 60 * 60;

const _SKEW_SCALE = bn(10_000);
const _MAX_FUNDING_VELOCITY = bn(3);
const _TRADER_SIZE = bn(20);
const _ETH_PRICE = bn(2000);

describe('Position - funding', () => {
  const { systems, perpsMarkets, provider, trader1, trader2, keeper } = bootstrapMarkets({
    synthMarkets: [],
    perpsMarkets: [
      {
        requestedMarketId: 25,
        name: 'Ether',
        token: 'snxETH',
        price: _ETH_PRICE,
        fundingParams: { skewScale: _SKEW_SCALE, maxFundingVelocity: bn(3) },
      },
    ],
    traderAccountIds: [2, 3],
  });

  let ethMarket: PerpsMarket;
  before('identify actors', async () => {
    ethMarket = perpsMarkets()[0];
  });

  before('add collateral to margin', async () => {
    // trader accruing funding
    await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(50_000));
    // trader moving skew
    await systems().PerpsMarket.connect(trader2()).modifyCollateral(3, 0, bn(1_000_000));
  });

  let openPositionTime: number;
  before('open 20 eth position', async () => {
    ({ settleTime: openPositionTime } = await openPosition({
      systems,
      provider,
      trader: trader1(),
      accountId: 2,
      keeper: keeper(),
      marketId: ethMarket.marketId(),
      sizeDelta: _TRADER_SIZE,
      settlementStrategyId: ethMarket.strategyId(),
      price: bn(2000),
    }));
  });

  /*
    +------------------------------------------------------------------------------------------------------------------------------+
    | Days elapsed |   Time   | Δ Skew | Skew | FR Velocity |    FR    | Accrued Funding |Accrued Funding|     Accrued Funding     |
    |              |          |        |      |             |          |     (Acc 2)     |    (Acc 3)    |           bn            |
    +------------------------------------------------------------------------------------------------------------------------------+
    |      0       |    0     |   0    |  20  |    0.006    |    0     |       0         |       0       |           0             |
    |      1       |  86400   |  -60   | -40  |    -0.012   |  0.006   |      120        |       0       |           0             |
    |      1       | 172800   |   15   | -25  |   -0.0075   |  -0.006  |      120        |      0.03     |  33333333333120000      |
    |     0.25     | 194400   |   37   |  12  |    0.0036   | -0.007875|     50.625      |    -156.09    | -156087499999999950000  |
    |      2       | 367200   |  -17   |  -5  |   -0.0015   | -0.000675|    -291.375     |    -136.79    | -136791111111111040000  |
    |     0.2      | 384480   |  155   | 150  |    0.045    | -0.000975|    -297.975     |     -8.25     | -8247222222222200000    |
    |     0.1      | 393120   | -150   |   0  |      0      | 0.003525 |    -292.875     |    -33.16     | -33157222222222020000   |
    |     0.1      | 401760   |  -15   | -15  |   -0.0045   | 0.003525 |    -278.775     |     14.10     | 14101111111111040000    |
    |     0.03     | 404352   |   -4   | -19  |   -0.0057   |  0.00339 |    -274.626     |      7.26     | 7261333333333240000     |
    |      3       | 663552   |   19   |   0  |      0      | -0.01371 |    -893.826     |   -1207.38    | -1207374999999999558000 |
    +------------------------------------------------------------------------------------------------------------------------------+

    Note: hardcoding the accrued funding for Acc 3 because rounding precision needs to be exact for the test to pass since events are 
    compared as text string, so is not possible to use assertBN.close() to compare the values.
  */

  [
    { daysElapsed: 1, newOrderSize: bn(-60), expectedAcc3Funding: '0' },
    { daysElapsed: 1, newOrderSize: bn(15), expectedAcc3Funding: '33333333333120000' },
    { daysElapsed: 0.25, newOrderSize: bn(37), expectedAcc3Funding: '-156087499999999950000' },
    { daysElapsed: 2, newOrderSize: bn(-17), expectedAcc3Funding: '-136791111111111040000' },
    { daysElapsed: 0.2, newOrderSize: bn(155), expectedAcc3Funding: '-8247222222222200000' },
    { daysElapsed: 0.1, newOrderSize: bn(-150), expectedAcc3Funding: '-33157222222222020000' },
    { daysElapsed: 0.1, newOrderSize: bn(-15), expectedAcc3Funding: '14101111111111040000' },
    { daysElapsed: 0.03, newOrderSize: bn(-4), expectedAcc3Funding: '7261333333333240000' },
    { daysElapsed: 3, newOrderSize: bn(19), expectedAcc3Funding: '-1207374999999999558000' },
  ].reduce(
    (
      {
        prevFrVelocity,
        prevFundingRate,
        prevAccruedFunding,
        prevSkew,
        prevSize,
        prevFillPrice,
        accDaysElapsed,
      },
      { daysElapsed, newOrderSize, expectedAcc3Funding }
    ) => {
      accDaysElapsed += daysElapsed;

      // ACCRUED FUNDING CALC ----------------------------------------------
      const currentSkew = prevSkew.add(newOrderSize);
      const newSize = prevSize.add(newOrderSize);
      const frVelocity = wei(currentSkew).div(_SKEW_SCALE).mul(_MAX_FUNDING_VELOCITY);
      const fundingRate = prevFrVelocity.mul(daysElapsed).add(prevFundingRate);
      const expectedAccruedFunding = Wei.avg(wei(prevFundingRate), wei(fundingRate))
        .mul(_TRADER_SIZE)
        .mul(_ETH_PRICE)
        .mul(daysElapsed)
        .add(prevAccruedFunding);
      // END ACCRUED FUNDING CALC -------------------------------------------

      let settleTx: ethers.providers.TransactionReceipt | ethers.providers.TransactionResponse;
      let fillPrice: ethers.BigNumber;
      let orderFees: ethers.BigNumber;

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

        before('capture data', async () => {
          [orderFees, fillPrice] = await systems().PerpsMarket.computeOrderFees(
            ethMarket.marketId(),
            newOrderSize
          );
        });

        before('trader2 moves skew', async () => {
          ({ settleTx } = await openPosition({
            systems,
            provider,
            trader: trader2(),
            accountId: 3,
            keeper: trader2(),
            marketId: ethMarket.marketId(),
            sizeDelta: newOrderSize,
            settlementStrategyId: ethMarket.strategyId(),
            price: bn(2000),
          }));
        });

        it('funding accrued is correct', async () => {
          const [, accruedFunding] = await systems().PerpsMarket.getOpenPosition(
            2,
            ethMarket.marketId()
          );
          // using negative value because trader pnl
          assertBn.near(accruedFunding, expectedAccruedFunding.mul(-1).toBN(), bn(0.1));
        });

        it('emits event settle event', async () => {
          const accountId = 3;
          const marketId = ethMarket.marketId();
          const expectedAcc3FundingBN = ethers.BigNumber.from(expectedAcc3Funding);

          const expectedSizeProfit = prevSize.mul(fillPrice.sub(prevFillPrice().bn));

          const pnl = expectedSizeProfit.add(expectedAcc3FundingBN);

          const sizeDelta = newOrderSize;

          const settlementReward = DEFAULT_SETTLEMENT_STRATEGY.settlementReward;
          const trackingCode = `"${ethers.constants.HashZero}"`;
          const msgSender = `"${await trader2().getAddress()}"`;

          const params = [
            marketId, // marketId
            accountId, // accountId
            fillPrice, // fillPrice
            pnl.bn, // pnl
            expectedAcc3FundingBN, // accruedFunding
            sizeDelta, // sizeDelta
            newSize.bn, // newPositionSize
            orderFees.add(settlementReward), // total fees
            0, // referral fees
            0, // collected fees
            settlementReward, // settlement reward
            trackingCode, // tracking code
            msgSender, // msgSender
          ];

          await assertEvent(settleTx, `OrderSettled(${params.join(', ')})`, systems().PerpsMarket);
        });
      });

      return {
        prevFrVelocity: frVelocity,
        prevFundingRate: fundingRate,
        prevAccruedFunding: expectedAccruedFunding,
        prevSkew: currentSkew,
        prevSize: newSize,
        prevFillPrice: () => wei(fillPrice),
        accDaysElapsed,
      };
    },
    {
      prevFrVelocity: wei(0.006),
      prevFundingRate: wei(0),
      prevAccruedFunding: wei(0),
      prevSkew: wei(20),
      prevSize: wei(0),
      prevFillPrice: () => wei(1998),
      accDaysElapsed: 0,
    }
  );
});
