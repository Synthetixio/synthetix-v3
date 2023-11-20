import { PerpsMarket, bn, bootstrapMarkets } from '../bootstrap';
import { openPosition } from '../helpers';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';

describe('Liquidation - with correct staleness tolerance', async () => {
  const { systems, provider, trader1, keeper, perpsMarkets, owner } = bootstrapMarkets({
    synthMarkets: [],
    perpsMarkets: [
      {
        requestedMarketId: 50,
        name: 'Optimism',
        token: 'OP',
        price: bn(10),
        orderFees: {
          makerFee: bn(0.007),
          takerFee: bn(0.003),
        },
        fundingParams: { skewScale: bn(1000), maxFundingVelocity: bn(0) },
        liquidationParams: {
          initialMarginFraction: bn(3),
          minimumInitialMarginRatio: bn(0),
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
    ],
    traderAccountIds: [2, 3],
  });

  let perpsMarket: PerpsMarket;
  before('identify actors', () => {
    perpsMarket = perpsMarkets()[0];
  });

  before('add collateral to margin', async () => {
    await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(1500));
  });

  before('open position', async () => {
    await openPosition({
      systems,
      provider,
      trader: trader1(),
      accountId: 2,
      keeper: keeper(),
      marketId: perpsMarket.marketId(),
      sizeDelta: bn(150),
      settlementStrategyId: perpsMarket.strategyId(),
      price: bn(10),
    });
  });

  before('lower price to liquidation', async () => {
    await perpsMarket.aggregator().mockSetCurrentPrice(bn(1));
  });

  before('change strict staleness tolerance', async () => {
    const { feedId } = await systems()
      .PerpsMarket.connect(owner())
      .getPriceData(perpsMarket.marketId());
    await systems()
      .PerpsMarket.connect(owner())
      .updatePriceData(perpsMarket.marketId(), feedId, 50);
  });

  describe('when strict tolerance', () => {
    it('reverts with OracleDataRequired', async () => {
      await assertRevert(
        systems().PerpsMarket.liquidate(2),
        ethers.utils.id('OracleDataRequired()').substring(0, 8) // first 4 bytes
      );
    });
  });
});
