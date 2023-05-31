import { BigNumber } from 'ethers';
import { bn, bootstrapMarkets } from '../bootstrap';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';

describe('GlobalPerpsMarket', () => {
  const { systems, perpsMarkets, trader1 } = bootstrapMarkets({
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
  });

  it('returns maxCollateralAmounts for synth market id', async () => {
    assertBn.equal(
      await systems().PerpsMarket.getMaxCollateralAmountsForSynthMarket(
        perpsMarkets()[0].marketId()
      ),
      bn(10000)
    );
  });

  it('returns the correct synthDeductionPriorty ', async () => {
    const synths = await systems().PerpsMarket.getSynthDeductionPriorty();
    synths.forEach((synth, index) => {
      assertBn.equal(synth, BigNumber.from(index + 1));
    });
  });

  it('transaction should fail if setter function are called by external user', async () => {
    const failSetMaxCollateralForSynthMarketId = systems()
      .PerpsMarket.connect(trader1())
      .setMaxCollateralForSynthMarketId(perpsMarkets()[0].marketId(), bn(10000));
    const failSetSynthDeductionPriorityTx = systems()
      .PerpsMarket.connect(trader1())
      .setSynthDeductionPriorty([1, 2]);
    assertRevert(
      failSetMaxCollateralForSynthMarketId,
      `Unauthorized("${await trader1().getAddress()}")`
    );
    assertRevert(
      failSetSynthDeductionPriorityTx,
      `Unauthorized("${await trader1().getAddress()}")`
    );
  });
});
