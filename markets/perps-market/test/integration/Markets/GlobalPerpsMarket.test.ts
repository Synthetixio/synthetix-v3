import { BigNumber, ethers } from 'ethers';
import { bn, bootstrapMarkets } from '../bootstrap';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assert from 'assert';
import { wei } from '@synthetixio/wei';

describe('GlobalPerpsMarket', () => {
  const { systems, perpsMarkets, signers, trader1, superMarketId, owner } = bootstrapMarkets({
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

  it('transaction should fail if min and max are inverted', async () => {
    await assertRevert(
      systems().PerpsMarket.connect(owner()).setLiquidationRewardGuards(500, 100),
      'InvalidParameter("min/maxLiquidationRewardUSD", "min > max")'
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

  describe('global settings are correct', () => {
    const referrerRatio = wei(0.1); // 10%
    let referrer: ethers.Signer;

    before('identify referrer', () => {
      referrer = signers()[8];
    });

    before('set fee collector and referral', async () => {
      await systems()
        .PerpsMarket.connect(owner())
        .setFeeCollector(systems().FeeCollectorMock.address);
      await systems()
        .PerpsMarket.connect(owner())
        .updateReferrerShare(await referrer.getAddress(), referrerRatio.toBN()); // 10%
    });

    it('reverts attempting to set an invalid fee collector', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(owner())
          .setFeeCollector(await referrer.getAddress()),
        `InvalidFeeCollectorInterface("${await referrer.getAddress()}")`
      );
    });

    it('fee collector is set correctly', async () => {
      assert.equal(
        await systems().PerpsMarket.getFeeCollector(),
        systems().FeeCollectorMock.address
      );
    });

    it('referrer share is set correctly', async () => {
      assertBn.equal(
        await systems().PerpsMarket.getReferrerShare(await referrer.getAddress()),
        referrerRatio.toBN()
      );
      assertBn.equal(await systems().PerpsMarket.getReferrerShare(ethers.constants.AddressZero), 0);
    });

    it('per account caps are set correctly', async () => {
      const { maxPositionsPerAccount, maxCollateralsPerAccount } =
        await systems().PerpsMarket.getPerAccountCaps();
      // check defaults set in bootstrap
      assertBn.equal(maxPositionsPerAccount, 100_000);
      assertBn.equal(maxCollateralsPerAccount, 100_000);
    });
  });
});
