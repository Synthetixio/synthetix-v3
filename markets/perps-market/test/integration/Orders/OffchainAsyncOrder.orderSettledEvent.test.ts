import { DEFAULT_SETTLEMENT_STRATEGY, PerpsMarket, bn, bootstrapMarkets } from '../bootstrap';
import { ethers } from 'ethers';
import { openPosition } from '../helpers';
import { wei } from '@synthetixio/wei';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';

const _SECONDS_IN_DAY = 24 * 60 * 60;

const _SKEW_SCALE = bn(10_000);
const _ETH_PRICE = bn(2000);
const _ORDER_FEES = {
  makerFee: wei(0.0003), // 3bps
  takerFee: wei(0.0008), // 8bps
};

describe('Offchain Async Order - OrderSettled event with funding', () => {
  const { systems, perpsMarkets, provider, trader1, keeper } = bootstrapMarkets({
    synthMarkets: [],
    perpsMarkets: [
      {
        requestedMarketId: 25,
        name: 'Ether',
        token: 'snxETH',
        price: _ETH_PRICE,
        fundingParams: { skewScale: _SKEW_SCALE, maxFundingVelocity: bn(3) },
        orderFees: {
          makerFee: _ORDER_FEES.makerFee.toBN(),
          takerFee: _ORDER_FEES.takerFee.toBN(),
        },
      },
    ],
    traderAccountIds: [2],
  });

  let ethMarket: PerpsMarket;
  let marketId: ethers.BigNumber;
  let msgSender: string;
  const accountId = 2;
  const settlementReward = DEFAULT_SETTLEMENT_STRATEGY.settlementReward;
  const trackingCode = `"${ethers.constants.HashZero}"`;
  const initialPositionSize = bn(20);

  before('identify actors', async () => {
    ethMarket = perpsMarkets()[0];
    marketId = ethMarket.marketId();
    msgSender = `"${await keeper().getAddress()}"`;
  });

  before('add collateral to margin', async () => {
    await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(1_000_000));
  });

  before('set Pyth Benchmark Price data', async () => {
    // set Pyth setBenchmarkPrice
    await systems().MockPythERC7412Wrapper.setBenchmarkPrice(_ETH_PRICE);
  });

  let fillPriceOrder1: ethers.BigNumber;
  let fillPriceOrder2: ethers.BigNumber;
  let orderFees: ethers.BigNumber;
  before('capture data', async () => {
    [orderFees, fillPriceOrder1] = await systems().PerpsMarket.computeOrderFees(
      ethMarket.marketId(),
      initialPositionSize
    );
  });

  let openPositionTime: number;
  let settleTx: ethers.providers.TransactionReceipt | ethers.providers.TransactionResponse;
  /*
    +------------------------------------------------------------------------------------------------------------------------------+
    | Days elapsed |   Time   | Δ Skew | Skew | FR Velocity |    FR    | Accrued Funding |Accrued Funding|     Accrued Funding     |
    |              |          |        |      |             |          |     Theoric     |    (Actual)   |           bn            |
    +------------------------------------------------------------------------------------------------------------------------------+
    |      0       |    0     |   0    |  20  |    0.006    |    0     |       0         |       0       |           0             |
    |      2       |  172800  |  10    |  30  |    0.009    |  0.0120  |      -480       |   -480.0222   | -480022222479423800000  |
    +------------------------------------------------------------------------------------------------------------------------------+
  */
  before('open first position 20 eth', async () => {
    ({ settleTime: openPositionTime, settleTx } = await openPosition({
      systems,
      provider,
      trader: trader1(),
      accountId: 2,
      keeper: keeper(),
      marketId: ethMarket.marketId(),
      sizeDelta: initialPositionSize,
      settlementStrategyId: ethMarket.strategyId(),
      price: _ETH_PRICE,
      skipSettingPrice: true,
    }));
  });

  it('emits OrderSettled event without funding (position opened)', async () => {
    const sizeDelta = initialPositionSize;
    const expectedFundingBN = ethers.BigNumber.from(0); // no funding yet, 0
    const expectedSizeProfit = bn(0); // no price profit yet, 0
    const pnl = expectedSizeProfit.add(expectedFundingBN);

    const params = [
      marketId, // marketId
      accountId, // accountId
      fillPriceOrder1, // fillPrice
      pnl, // pnl
      expectedFundingBN, // accruedFunding
      sizeDelta, // sizeDelta
      initialPositionSize, // newPositionSize
      orderFees.add(settlementReward), // total fees
      0, // referral fees
      0, // collected fees
      settlementReward, // settlement reward
      trackingCode, // tracking code
      msgSender, // msgSender
    ];

    await assertEvent(settleTx, `OrderSettled(${params.join(', ')})`, systems().PerpsMarket);
  });

  describe('after some time modify the position', () => {
    const daysElapsed = 2;
    const sizeDelta = bn(10);

    before('move time', async () => {
      await fastForwardTo(
        openPositionTime -
          // this enables the market summary check to be as close as possible to the settlement time
          (DEFAULT_SETTLEMENT_STRATEGY.settlementDelay - 1) + // settlement strategy delay accounted for
          _SECONDS_IN_DAY * daysElapsed,
        provider()
      );
    });

    before('capture data', async () => {
      [orderFees, fillPriceOrder2] = await systems().PerpsMarket.computeOrderFees(
        ethMarket.marketId(),
        sizeDelta
      );
    });

    before('trader2 moves skew', async () => {
      ({ settleTx } = await openPosition({
        systems,
        provider,
        trader: trader1(),
        accountId: 2,
        keeper: keeper(),
        marketId: ethMarket.marketId(),
        sizeDelta: sizeDelta,
        settlementStrategyId: ethMarket.strategyId(),
        price: _ETH_PRICE,
        skipSettingPrice: true,
      }));
    });

    it('emits OrderSettled event with right funding (position change  2 days after)', async () => {
      // Accrued funding for skew = 20 for 2 days @ 2000 usd/eth = -480 USD
      // due to differences in timing (not exactly 2 x 86400 seconds) the accrued funding is slightly different
      // and since we need to compare it as a string, we need to hardcode it. Actual number is -480.022222479423800000
      const expectedFundingBN = ethers.BigNumber.from('-480022222479423800000');
      const expectedSizeProfit = wei(fillPriceOrder2)
        .sub(wei(fillPriceOrder1))
        .mul(wei(initialPositionSize)).bn;
      const pnl = expectedSizeProfit.add(expectedFundingBN);

      const params = [
        marketId, // marketId
        accountId, // accountId
        fillPriceOrder2, // fillPrice
        pnl, // pnl
        expectedFundingBN, // accruedFunding
        sizeDelta, // sizeDelta
        sizeDelta.add(initialPositionSize), // newPositionSize
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
});
