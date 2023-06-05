import { BigNumber } from 'ethers';
import { bn, bootstrapMarkets } from '../bootstrap';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';

describe.only('GlobalPerpsMarket', () => {
  const { systems, perpsMarkets, trader1 } = bootstrapMarkets({
    synthMarkets: [{ name: 'Ether', token: 'snxETH', buyPrice: bn(1000), sellPrice: bn(1000) }],
    perpsMarkets: [{ name: 'Ether', token: 'snxETH', price: bn(1000) }],
    traderAccountIds: [],
  });

  before(
    'set maxCollateralAmounts, synthDeductionPriority, minLiquidationRewardUsd, maxLiquidationRewardUsd',
    async () => {
      await systems().PerpsMarket.setMaxCollateralForSynthMarketId(
        perpsMarkets()[0].marketId(),
        bn(10000)
      );
      await systems().PerpsMarket.setSynthDeductionPriorty([1, 2]);
      await systems().PerpsMarket.setMinLiquidationRewardUsd(100);
      await systems().PerpsMarket.setMaxLiquidationRewardUsd(500);
    }
  );

  it('returns maxCollateralAmounts for synth market id', async () => {
    assertBn.equal(
      await systems().PerpsMarket.getMaxCollateralAmountsForSynthMarket(
        perpsMarkets()[0].marketId()
      ),
      bn(10000)
    );
  });

  it('returns the correct synthDeductionPriority ', async () => {
    const synths = await systems().PerpsMarket.getSynthDeductionPriorty();
    synths.forEach((synth, index) => {
      assertBn.equal(synth, BigNumber.from(index + 1));
    });
  });

  it('returns the correct minLiquidationRewardUsd ', async () => {
    assertBn.equal(await systems().PerpsMarket.getMinLiquidationRewardUsd(), 100);
  });

  it('returns the correct maxLiquidationRewardUsd ', async () => {
    assertBn.equal(await systems().PerpsMarket.getMaxLiquidationRewardUsd(), 500);
  });

  it('transaction should fail if setter function are called by external user', async () => {
    await assertRevert(
      systems().PerpsMarket.connect(trader1()).setMinLiquidationRewardUsd(100),
      `Unauthorized("${await trader1().getAddress()}")`
    );
    await assertRevert(
      systems().PerpsMarket.connect(trader1()).setMaxLiquidationRewardUsd(500),
      `Unauthorized("${await trader1().getAddress()}")`
    );
    await assertRevert(
      systems()
        .PerpsMarket.connect(trader1())
        .setMaxCollateralForSynthMarketId(perpsMarkets()[0].marketId(), bn(10000)),
      `Unauthorized("${await trader1().getAddress()}")`
    );
    await assertRevert(
      systems().PerpsMarket.connect(trader1()).setSynthDeductionPriorty([1, 2]),
      `Unauthorized("${await trader1().getAddress()}")`
    );
  });
});
