import { bn, bootstrapMarkets } from '../bootstrap';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';

describe('GlobalPerpsMarket', () => {
  const { systems, perpsMarkets } = bootstrapMarkets({
    synthMarkets: [{ name: 'Ether', token: 'snxETH', buyPrice: bn(1000), sellPrice: bn(1000) }],
    perpsMarkets: [{ name: 'Ether', token: 'snxETH', price: bn(1000) }],
    traderAccountIds: [],
  });

  before('set maxCollateralAmounts, synthDeductionPriority and maxLeverage', async () => {
    await systems().PerpsMarket.setMaxCollateralForSynthMarketId(
      perpsMarkets()[0].marketId(),
      bn(10000)
    );
    await systems().PerpsMarket.setSynthDeductionPriorty([1, 2]);
    await systems().PerpsMarket.setMaxLeverage(1);

    it('returns maxCollateralAmounts for synth market id', async () => {
      assertBn.equal(
        await systems().PerpsMarket.getMaxCollateralAmountsForSynthMarket(
          perpsMarkets()[0].marketId()
        ),
        bn(1000)
      );
    });
  });
});
