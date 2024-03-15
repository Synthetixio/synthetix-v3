import { BigNumber, ethers } from 'ethers';
import { bn, bootstrapMarkets } from '../bootstrap';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assert from 'assert';
import { wei } from '@synthetixio/wei';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';

describe('GlobalPerpsMarket', () => {
  const { systems, perpsMarkets, synthMarkets, signers, trader1, superMarketId, owner } =
    bootstrapMarkets({
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
      await systems().PerpsMarket.setCollateralConfiguration(
        perpsMarkets()[0].marketId(),
        bn(10000),
        0,
        0,
        0
      );
      await systems().PerpsMarket.setSynthDeductionPriority([1, 2]);
      await systems().PerpsMarket.setKeeperRewardGuards(100, bn(0.001), 500, bn(0.005));
    }
  );

  it('returns the supermarket name', async () => {
    assert.equal(await systems().PerpsMarket.name(superMarketId()), 'SuperMarket Perps Market');
    assert.equal(await systems().PerpsMarket.name(0), '');
  });

  it('returns the list of supported collaterals', async () => {
    const supportedCollaterals = await systems().PerpsMarket.getSupportedCollaterals();
    // Note bootstrapMarkets will add snxUSD as the first collateral and then all the synthMarkets
    assert.equal(supportedCollaterals.length, 3);
    // index 0 is the snxUSD
    assertBn.equal(supportedCollaterals[0], bn(0));
    // index 1 is the synthMarket for snxETH
    assertBn.equal(supportedCollaterals[1], synthMarkets()[0].marketId());
    // index 2 is perps market for snxETH (added in the before)
    assertBn.equal(supportedCollaterals[2], perpsMarkets()[0].marketId());
  });

  it('can call initialize again but will not change the config', async () => {
    await assertEvent(
      await systems()
        .PerpsMarket.connect(owner())
        .initializeFactory(await trader1().getAddress(), await trader1().getAddress()),
      'FactoryInitialized(1)',
      systems().PerpsMarket
    );

    assert.equal(await systems().PerpsMarket.name(superMarketId()), 'SuperMarket Perps Market');
  });

  it('returns maxCollateralAmount and strictStalenessTolerance for synth market id', async () => {
    const maxCollateralAmount = await systems().PerpsMarket.getCollateralConfiguration(
      perpsMarkets()[0].marketId()
    );
    assertBn.equal(maxCollateralAmount, bn(10000));
  });

  it('returns the correct synthDeductionPriority ', async () => {
    const synths = await systems().PerpsMarket.getSynthDeductionPriority();
    synths.forEach((synth, index) => {
      assertBn.equal(synth, BigNumber.from(index + 1));
    });
  });

  it('returns the correct minKeeperRewardUsd ', async () => {
    const liquidationGuards = await systems().PerpsMarket.getKeeperRewardGuards();
    assertBn.equal(liquidationGuards.minKeeperRewardUsd, 100);
    assertBn.equal(liquidationGuards.minKeeperProfitRatioD18, bn(0.001));
    assertBn.equal(liquidationGuards.maxKeeperRewardUsd, 500);
    assertBn.equal(liquidationGuards.maxKeeperScalingRatioD18, bn(0.005));
  });

  it('transaction should fail if setter function are called by external user', async () => {
    await assertRevert(
      systems()
        .PerpsMarket.connect(trader1())
        .setKeeperRewardGuards(100, bn(0.001), 500, bn(0.005)),
      `Unauthorized("${await trader1().getAddress()}")`
    );
    await assertRevert(
      systems()
        .PerpsMarket.connect(trader1())
        .setCollateralConfiguration(perpsMarkets()[0].marketId(), bn(10000), 0, 0, 0),
      `Unauthorized("${await trader1().getAddress()}")`
    );
    await assertRevert(
      systems().PerpsMarket.connect(trader1()).setSynthDeductionPriority([1, 2]),
      `Unauthorized("${await trader1().getAddress()}")`
    );
  });

  it('transaction should fail if min and max are inverted', async () => {
    await assertRevert(
      systems().PerpsMarket.connect(owner()).setKeeperRewardGuards(500, bn(0.001), 100, bn(0.005)),
      'InvalidParameter("min/maxKeeperRewardUSD", "min > max")'
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

  describe('remove a supported collaterals', () => {
    before('remove a supported collateral by setting its max to zero', async () => {
      await systems().PerpsMarket.setCollateralConfiguration(
        perpsMarkets()[0].marketId(),
        bn(0),
        0,
        0,
        0
      );
    });

    it('the removed market was gone from supportedCollaterals', async () => {
      const supportedCollaterals = await systems().PerpsMarket.getSupportedCollaterals();
      assert.equal(supportedCollaterals.length, 2);
      assertBn.equal(supportedCollaterals[0], bn(0));
      assertBn.equal(supportedCollaterals[1], synthMarkets()[0].marketId());
    });
  });

  describe('set interest rate params', () => {
    // only owner can set params
    it('reverts if not owner', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(trader1())
          .setInterestRateParameters(bn(0.1), bn(0.2), bn(0.3)),
        `Unauthorized("${await trader1().getAddress()}")`
      );
    });

    it('reverts if low gradient higher than high gradient', async () => {
      await assertRevert(
        systems().PerpsMarket.connect(owner()).setInterestRateParameters(bn(0.3), bn(0.2), bn(0.1)),
        `InvalidInterestRateParameters(${bn(0.3)}, ${bn(0.1)})`
      );
    });

    describe('correct params', () => {
      before('set interest rate params', async () => {
        await systems()
          .PerpsMarket.connect(owner())
          .setInterestRateParameters(bn(0.1), bn(0.2), bn(0.3));
      });

      it('sets the correct interest rate params', async () => {
        const params = await systems().PerpsMarket.getInterestRateParameters();

        assertBn.equal(params.lowUtilizationInterestRateGradient, bn(0.1));
        assertBn.equal(params.interestRateGradientBreakpoint, bn(0.2));
        assertBn.equal(params.highUtilizationInterestRateGradient, bn(0.3));
      });
    });
  });
});
