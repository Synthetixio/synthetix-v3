import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { bn, bootstrapMarkets } from '../bootstrap';
import { OpenPositionData, openPosition } from '../helpers';
import { ethers } from 'ethers';
import { wei } from '@synthetixio/wei';

const PRICE = bn(0.00000001);
const NOTIONAL = bn(10_000_000); // sizeDelta = 1_000_000_000_000_000 (1e15)
describe('Large Size Position', async () => {
  const perpsMarketConfigs = [
    {
      requestedMarketId: 50,
      name: 'ThisIsNotPepe',
      token: 'NOT_PEPE',
      price: PRICE,
      fundingParams: { skewScale: bn(30_000_000_000_000_000), maxFundingVelocity: bn(0) },
      maxMarketValue: bn(100_000_000_000_000_000),
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
    },
  ];

  const { systems, provider, trader1, perpsMarkets, keeper } = bootstrapMarkets({
    synthMarkets: [],
    perpsMarkets: perpsMarketConfigs,
    traderAccountIds: [2],
  });

  before('add collateral to margin', async () => {
    await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(10_000_000));
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

  before('open position', async () => {
    const sizeDelta = wei(NOTIONAL).div(wei(PRICE));
    await openPosition({
      ...commonOpenPositionProps,
      marketId: perpsMarkets()[0].marketId(),
      sizeDelta: sizeDelta.bn,
      settlementStrategyId: perpsMarkets()[0].strategyId(),
      price: PRICE,
    });
  });

  it('should have correct open interest', async () => {
    assertBn.equal(await systems().PerpsMarket.totalAccountOpenInterest(2), NOTIONAL);
  });

  describe('can liquidate the position', async () => {
    before('lower price to liquidation', async () => {
      await perpsMarkets()[0].aggregator().mockSetCurrentPrice(PRICE.div(100));
    });
    before('call liquidate', async () => {
      await systems().PerpsMarket.connect(keeper()).liquidate(2);
    });

    it('liquidated the position', async () => {
      const [, , size] = await systems().PerpsMarket.getOpenPosition(
        2,
        perpsMarkets()[0].marketId()
      );
      assertBn.equal(size, bn(0));
    });
  });
});
