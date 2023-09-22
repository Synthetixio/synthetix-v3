import { BigNumber } from 'ethers';
import { bn, bootstrapMarkets } from '../bootstrap';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assert from 'assert';

describe('GlobalPerpsMarket', () => {
  const { systems, perpsMarkets, trader1, superMarketId } = bootstrapMarkets({
    synthMarkets: [{ name: 'Ether', token: 'snxETH', buyPrice: bn(1000), sellPrice: bn(1000) }],
    perpsMarkets: [
      { requestedMarketId: 25, name: 'Ether', token: 'snxETH', price: bn(1000) },
      { requestedMarketId: 50, name: 'Btc', token: 'snxBTC', price: bn(10000) },
    ],
    traderAccountIds: [],
  });

  before(
    'set maxCollateralAmounts, synthDeductionPriority, minLiquidationRewardUsd, maxLiquidationRewardUsd',
    async () => {
      await systems().PerpsMarket.setMaxCollateralAmount(perpsMarkets()[0].marketId(), bn(10000));
      await systems().PerpsMarket.setSynthDeductionPriority([1, 2]);
      await systems().PerpsMarket.setLiquidationRewardGuards(100, 500);
    }
  );

  it('returns the supermarket name', async () => {
    assert.equal(await systems().PerpsMarket.name(superMarketId()), 'SuperMarket Perps Market');
    assert.equal(await systems().PerpsMarket.name(0), '');
  });

  it('returns maxCollateralAmounts for synth market id', async () => {
    assertBn.equal(
      await systems().PerpsMarket.getMaxCollateralAmount(perpsMarkets()[0].marketId()),
      bn(10000)
    );
  });

  it('returns the correct synthDeductionPriority ', async () => {
    const synths = await systems().PerpsMarket.getSynthDeductionPriority();
    synths.forEach((synth, index) => {
      assertBn.equal(synth, BigNumber.from(index + 1));
    });
  });

  it('returns the correct minLiquidationRewardUsd ', async () => {
    const liquidationGuards = await systems().PerpsMarket.getLiquidationRewardGuards();
    assertBn.equal(liquidationGuards.minLiquidationRewardUsd, 100);
    assertBn.equal(liquidationGuards.maxLiquidationRewardUsd, 500);
  });

  it('transaction should fail if setter function are called by external user', async () => {
    await assertRevert(
      systems().PerpsMarket.connect(trader1()).setLiquidationRewardGuards(100, 500),
      `Unauthorized("${await trader1().getAddress()}")`
    );
    await assertRevert(
      systems()
        .PerpsMarket.connect(trader1())
        .setMaxCollateralAmount(perpsMarkets()[0].marketId(), bn(10000)),
      `Unauthorized("${await trader1().getAddress()}")`
    );
    await assertRevert(
      systems().PerpsMarket.connect(trader1()).setSynthDeductionPriority([1, 2]),
      `Unauthorized("${await trader1().getAddress()}")`
    );
  });

  describe('getMarkets()', () => {
    it('returns all markets', async () => {
      const markets = await systems().PerpsMarket.getMarkets();
      assertBn.equal(markets.length, 2);
      assertBn.equal(markets[0], perpsMarkets()[0].marketId());
      assertBn.equal(markets[1], perpsMarkets()[1].marketId());
    });
  });
});
