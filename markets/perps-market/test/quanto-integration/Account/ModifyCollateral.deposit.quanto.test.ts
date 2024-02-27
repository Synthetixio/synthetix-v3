import { ethers } from 'ethers';
import { bn, bootstrapMarkets } from '../../integration/bootstrap';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import { deepEqual } from 'assert/strict';
import { ONE_ETHER } from '../../integration/helpers/';

describe('ModifyCollateral Deposit', () => {
  // Account and Market Identifiers
  const accountIds = [10, 20];
  const ethMarketId = 26;
  const quantoSynthMarketIndex = 0;

  // Market Prices
  const btcPrice = bn(10_000);
  const ethPrice = bn(1_000);

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
  const marginAmount = bn(10_000);

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
  ];

  // Bootstrap Markets, Systems, and Accounts
  const { systems, owner, superMarketId, synthMarkets, trader1 } = bootstrapMarkets({
    synthMarkets: spotMarketConfig,
    perpsMarkets: perpsMarketConfig,
    traderAccountIds: accountIds,
  });

  let synthBTCMarketId: ethers.BigNumber;
  let synthETHMarketId: ethers.BigNumber;

  before('identify actors', () => {
    synthBTCMarketId = synthMarkets()[0].marketId(); // 2
    synthETHMarketId = synthMarkets()[1].marketId(); // 3
  });

  describe('deposit by modifyCollateral()', () => {
    let spotBalanceBefore: ethers.BigNumber;
    let modifyCollateralTxn: ethers.providers.TransactionResponse;

    before('owner sets limits to max', async () => {
      await systems()
        .PerpsMarket.connect(owner())
        .setCollateralConfiguration(synthBTCMarketId, ethers.constants.MaxUint256);
    });

    before('trader1 buys 1 snxBTC', async () => {
      await systems()
        .SpotMarket.connect(trader1())
        .buy(synthBTCMarketId, marginAmount, ONE_ETHER, ethers.constants.AddressZero);
    });

    before('trader1 buys 1 snxETH', async () => {
      await systems()
        .SpotMarket.connect(trader1())
        .buy(synthETHMarketId, marginAmount, ONE_ETHER, ethers.constants.AddressZero);
    });

    before('record balances', async () => {
      spotBalanceBefore = await synthMarkets()[0]
        .synth()
        .connect(trader1())
        .balanceOf(await trader1().getAddress());
    });

    before('trader1 approves the perps market', async () => {
      await synthMarkets()[0]
        .synth()
        .connect(trader1())
        .approve(systems().PerpsMarket.address, ONE_ETHER);

      await synthMarkets()[1]
        .synth()
        .connect(trader1())
        .approve(systems().PerpsMarket.address, ONE_ETHER);
    });

    before('trader1 adds collateral', async () => {
      modifyCollateralTxn = await systems()
        .PerpsMarket.connect(trader1())
        .modifyCollateral(accountIds[0], synthBTCMarketId, ONE_ETHER);
    });

    it('properly reflects the total collateral value', async () => {
      const totalValue = await systems().PerpsMarket.totalCollateralValue(accountIds[0]);
      assertBn.equal(totalValue, marginAmount);
    });

    it('properly reflects the total account open interest', async () => {
      const totalOpenInterest = await systems().PerpsMarket.totalAccountOpenInterest(accountIds[0]);
      assertBn.equal(totalOpenInterest, 0); // only deposited - did not open a position
    });

    it('properly reflects trader1 spot balance', async () => {
      const spotBalanceAfter = await synthMarkets()[0]
        .synth()
        .connect(trader1())
        .balanceOf(await trader1().getAddress());
      assertBn.equal(spotBalanceAfter, spotBalanceBefore.sub(ONE_ETHER));
    });

    it('properly reflects core system collateral balance', async () => {
      const btcCollateralValue = await systems().Core.getMarketCollateralAmount(
        superMarketId(),
        synthMarkets()[0].synthAddress()
      );

      assertBn.equal(btcCollateralValue, ONE_ETHER);
    });

    it('emits correct event with the expected values', async () => {
      await assertEvent(
        modifyCollateralTxn,
        `CollateralModified(${accountIds[0]}, ${synthBTCMarketId}, ${bn(
          1
        )}, "${await trader1().getAddress()}"`,
        systems().PerpsMarket
      );
    });

    it('returns the correct amount when calling getCollateralAmount', async () => {
      const collateralBalance = await systems().PerpsMarket.getCollateralAmount(
        accountIds[0],
        synthBTCMarketId
      );
      assertBn.equal(collateralBalance, bn(1));
    });

    it('returns the correct list of active collaterals', async () => {
      const activeCollaterals = await systems().PerpsMarket.getAccountCollateralIds(accountIds[0]);

      deepEqual([synthBTCMarketId], activeCollaterals);
    });

    it('trader1 adds snxETH collateral', async () => {
      await systems()
        .PerpsMarket.connect(trader1())
        .modifyCollateral(accountIds[0], synthETHMarketId, ONE_ETHER);
    });

    it('returns the correct list of active collaterals', async () => {
      const activeCollaterals = await systems().PerpsMarket.getAccountCollateralIds(accountIds[0]);

      deepEqual([synthBTCMarketId, synthETHMarketId], activeCollaterals);
    });
  });
});
