import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';
import { bn, bootstrapMarkets } from '../../integration/bootstrap';
import { ONE_ETHER } from '../../integration/helpers/';

describe('ModifyCollateral', () => {
  // Account and Market Identifiers
  const accountIds = [10, 20];
  const invalidAccountId = 42069;
  const ethMarketId = 26;
  const quantoSynthMarketIndex = 0;

  // Market Prices
  const btcPrice = bn(10_000);
  const ethPrice = bn(1_000);
  const linkPrice = bn(5);

  // Skew Scales
  const ethSkewScale = bn(1000).div(2000);

  // Margin and Funding Parameters
  const maxFundingVelocity = bn(0);
  const initialMarginFraction = bn(2);
  const minimumInitialMarginRatio = bn(0.01);
  const maintenanceMarginScalar = bn(0.5);
  const maxLiquidationLimitAccumulationMultiplier = bn(1);
  const liquidationRewardRatio = bn(0.05);
  const maxSecondsInLiquidationWindow = ethers.BigNumber.from(10);

  // Position Margins
  const ethMinimumPositionMargin = bn(500);

  // Liquidation Parameters
  const settlementReward = bn(0);

  // Perps Market Config
  const perpsMarketConfig = [
    {
      requestedMarketId: ethMarketId,
      name: 'Ether',
      token: 'ETH',
      price: ethPrice,
      fundingParams: { skewScale: ethSkewScale, maxFundingVelocity: maxFundingVelocity },
      liquidationParams: {
        initialMarginFraction: initialMarginFraction,
        minimumInitialMarginRatio: minimumInitialMarginRatio,
        maintenanceMarginScalar: maintenanceMarginScalar,
        maxLiquidationLimitAccumulationMultiplier: maxLiquidationLimitAccumulationMultiplier,
        liquidationRewardRatio: liquidationRewardRatio,
        maxSecondsInLiquidationWindow: maxSecondsInLiquidationWindow,
        minimumPositionMargin: ethMinimumPositionMargin,
      },
      settlementStrategy: {
        settlementReward: settlementReward,
      },
      quanto: {
        name: 'Ether',
        token: 'ETH',
        price: ethPrice,
        quantoSynthMarketIndex: quantoSynthMarketIndex,
      },
    },
  ];

  // Spot Market Config
  const spotMarketConfig = [
    {
      name: 'Bitcoin',
      token: 'snxBTC',
      buyPrice: btcPrice,
      sellPrice: btcPrice,
    },
    {
      name: 'Ether',
      token: 'snxETH',
      buyPrice: ethPrice,
      sellPrice: ethPrice,
    },
    {
      name: 'Link',
      token: 'snxLink',
      buyPrice: linkPrice,
      sellPrice: linkPrice,
    },
  ];

  const { systems, owner, synthMarkets, trader1, trader2 } = bootstrapMarkets({
    synthMarkets: spotMarketConfig,
    perpsMarkets: perpsMarketConfig,
    traderAccountIds: accountIds,
  });

  const PERPS_MODIFY_COLLATERAL_PERMISSION_NAME =
    ethers.utils.formatBytes32String('PERPS_MODIFY_COLLATERAL');

  let synthBTCMarketId: ethers.BigNumber;
  let synthETHMarketId: ethers.BigNumber;
  let synthLINKMarketId: ethers.BigNumber;

  before('identify actors', () => {
    synthBTCMarketId = synthMarkets()[0].marketId();
    synthETHMarketId = synthMarkets()[1].marketId();
    synthLINKMarketId = synthMarkets()[2].marketId();
  });

  before('set setCollateralConfiguration to 1 btc', async () => {
    await systems()
      .PerpsMarket.connect(owner())
      .setCollateralConfiguration(synthBTCMarketId, bn(1));
  });

  before('set setCollateralConfiguration to 0 link', async () => {
    await systems()
      .PerpsMarket.connect(owner())
      .setCollateralConfiguration(synthLINKMarketId, bn(0));
  });

  before('trader1 buys 100 snxLink', async () => {
    const usdAmount = bn(100);
    const minAmountReceived = bn(20);
    const referrer = ethers.constants.AddressZero;
    await systems()
      .SpotMarket.connect(trader1())
      .buy(synthLINKMarketId, usdAmount, minAmountReceived, referrer);
  });

  describe('failure cases', () => {
    it('reverts when the account does not exist', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(trader2())
          .modifyCollateral(invalidAccountId, synthBTCMarketId, ONE_ETHER),
        `AccountNotFound("${invalidAccountId}"`
      );
    });

    it('reverts when the msg sender does not have valid permission', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(owner())
          .modifyCollateral(accountIds[1], synthBTCMarketId, ONE_ETHER),
        `PermissionDenied("${
          accountIds[1]
        }", "${PERPS_MODIFY_COLLATERAL_PERMISSION_NAME}", "${await owner().getAddress()}")`
      );
    });

    it('reverts when trying to modify collateral with a zero amount delta', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(trader1())
          .modifyCollateral(accountIds[0], synthBTCMarketId, bn(0)),
        `InvalidAmountDelta("${bn(0)}")`
      );
    });

    it('reverts when trying to add synths not approved for collateral', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(trader1())
          .modifyCollateral(accountIds[0], synthLINKMarketId, bn(50)),
        `SynthNotEnabledForCollateral("${synthLINKMarketId}")`
      );
    });

    it('reverts when trying to add non existent synth as collateral', async () => {
      const nonExistingSynthMarketId = bn(42069);
      await assertRevert(
        systems()
          .PerpsMarket.connect(trader1())
          .modifyCollateral(accountIds[0], nonExistingSynthMarketId, bn(2)),
        `SynthNotEnabledForCollateral("${nonExistingSynthMarketId}")`
      );
    });

    it('reverts when it exceeds the max collateral amount', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(trader1())
          .modifyCollateral(accountIds[0], synthBTCMarketId, bn(2)),
        `MaxCollateralExceeded("${synthBTCMarketId}", "${bn(1)}", "${bn(0)}", "${bn(2)}")`
      );
    });

    it('reverts if the trader does not have enough allowance', async () => {
      await systems()
        .PerpsMarket.connect(owner())
        .setCollateralConfiguration(synthETHMarketId, ONE_ETHER);

      await assertRevert(
        systems()
          .PerpsMarket.connect(trader1())
          .modifyCollateral(accountIds[0], synthETHMarketId, ONE_ETHER),
        `InsufficientAllowance("${ONE_ETHER}", "0")`
      );
    });

    it('reverts if the trader does not have enough spot balance', async () => {
      await systems()
        .PerpsMarket.connect(owner())
        .setCollateralConfiguration(synthBTCMarketId, ONE_ETHER);

      await synthMarkets()[0]
        .synth()
        .connect(trader1())
        .approve(systems().PerpsMarket.address, ONE_ETHER);

      await assertRevert(
        systems()
          .PerpsMarket.connect(trader1())
          .modifyCollateral(accountIds[0], synthBTCMarketId, ONE_ETHER),
        `InsufficientBalance("${ONE_ETHER}", "0")`
      );
    });
  });
});
