import { PerpsMarket, bn, bootstrapMarkets } from './bootstrap';
import { calculateInterestRate, openPosition } from './helpers';
import Wei, { wei } from '@synthetixio/wei';
import { ethers } from 'ethers';
import { fastForwardTo, getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';

const _SECONDS_IN_DAY = 24 * 60 * 60;

const _TRADER_SIZE = wei(200);
const _ETH_PRICE = wei(2000);
const _ETH_LOCKED_OI_RATIO = wei(1);

const interestRateParams = {
  lowUtilGradient: wei(0.0003),
  gradientBreakpoint: wei(0.75),
  highUtilGradient: wei(0.01),
};

describe('Insolvent test', () => {
  const { systems, perpsMarkets, superMarketId, provider, trader1, keeper, staker } =
    bootstrapMarkets({
      interestRateParams: {
        lowUtilGradient: interestRateParams.lowUtilGradient.toBN(),
        gradientBreakpoint: interestRateParams.gradientBreakpoint.toBN(),
        highUtilGradient: interestRateParams.highUtilGradient.toBN(),
      },
      synthMarkets: [],
      perpsMarkets: [
        {
          lockedOiRatioD18: _ETH_LOCKED_OI_RATIO.toBN(),
          requestedMarketId: 25,
          name: 'Ether',
          token: 'snxETH',
          price: _ETH_PRICE.toBN(),
        },
      ],
      traderAccountIds: [2],
    });

  let ethMarket: PerpsMarket;

  before('identify actors', async () => {
    ethMarket = perpsMarkets()[0];
  });

  before('add collateral to margin', async () => {
    await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(50_000));
  });

  const checkMarketInterestRate = () => {
    let currentInterestRate: Wei;
    it('has correct interest rate', async () => {
      const withdrawableUsd = wei(await systems().Core.getWithdrawableMarketUsd(superMarketId()));
      const totalCollateralValue = wei(await systems().PerpsMarket.totalGlobalCollateralValue());
      const delegatedCollateral = withdrawableUsd.sub(totalCollateralValue);

      const snxUsdValue = wei(await systems().PerpsMarket.globalCollateralValue(0));
      const minCredit = wei(await systems().PerpsMarket.minimumCredit(superMarketId())).sub(
        snxUsdValue
      );

      const utilRate = delegatedCollateral.gt(0) ? minCredit.div(delegatedCollateral) : wei(1);
      currentInterestRate = calculateInterestRate(utilRate, interestRateParams);
      assertBn.near(
        await systems().PerpsMarket.interestRate(),
        currentInterestRate.toBN(),
        bn(0.0001)
      );
      const { rate: expectedUtilizationRate } = await systems().PerpsMarket.utilizationRate();
      assertBn.near(expectedUtilizationRate, utilRate.toBN(), bn(0.0001));
    });

    return {
      currentInterestRate: () => currentInterestRate,
    };
  };

  before('fast forward time', async () => {
    await fastForwardTo((await getTime(provider())) + _SECONDS_IN_DAY * 10, provider());
  });

  let delegatedCollateralValue: Wei;
  before('undelegate', async () => {
    const currentCollateralAmount = await systems().Core.getPositionCollateral(
      1,
      1,
      systems().CollateralMock.address
    );
    console.log(currentCollateralAmount);
    // very low amount to make market insolvent
    await systems()
      .Core.connect(staker())
      .delegateCollateral(
        1,
        1,
        systems().CollateralMock.address,
        wei(currentCollateralAmount).mul(wei(0.1)).toBN(),
        ethers.utils.parseEther('1')
      );
    // this ends up being total delegated collateral value
    delegatedCollateralValue = wei(200_000);
  });

  it('reverts if attempting to open position when market insolved', async () => {
    await assertRevert(
      systems()
        .PerpsMarket.connect(trader1())
        .commitOrder({
          marketId: ethMarket.marketId(),
          accountId: 2,
          sizeDelta: _TRADER_SIZE.toBN(),
          settlementStrategyId: ethMarket.strategyId(),
          acceptablePrice: _ETH_PRICE.mul(2).toBN(),
          referrer: ethers.constants.AddressZero,
          trackingCode: ethers.constants.HashZero,
        }),
      `ExceedsMarketCreditCapacity("${delegatedCollateralValue.toString(18, true)}", "${_TRADER_SIZE.mul(_ETH_PRICE).toString(18, true)}")`,
      systems().PerpsMarket
    );
  });

  describe('open position', () => {
    before(async () => {
      await openPosition({
        systems,
        provider,
        trader: trader1(),
        accountId: 2,
        keeper: keeper(),
        marketId: ethMarket.marketId(),
        sizeDelta: bn(50),
        settlementStrategyId: ethMarket.strategyId(),
        price: bn(2_000),
      });
    });

    it('reverts when attempting to open position above market credit capacity', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(trader1())
          .commitOrder({
            marketId: ethMarket.marketId(),
            accountId: 2,
            sizeDelta: bn(60),
            settlementStrategyId: ethMarket.strategyId(),
            acceptablePrice: _ETH_PRICE.mul(2).toBN(),
            referrer: ethers.constants.AddressZero,
            trackingCode: ethers.constants.HashZero,
          }),
        `ExceedsMarketCreditCapacity("${delegatedCollateralValue.toString(18, true)}", "${wei(60).add(wei(50)).mul(_ETH_PRICE).toString(18, true)}")`,
        systems().PerpsMarket
      );
    });

    it('reverts when attempting to open position in the opposite direction above market credit capacity', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(trader1())
          .commitOrder({
            marketId: ethMarket.marketId(),
            accountId: 2,
            sizeDelta: bn(-160),
            settlementStrategyId: ethMarket.strategyId(),
            acceptablePrice: _ETH_PRICE.mul(2).toBN(),
            referrer: ethers.constants.AddressZero,
            trackingCode: ethers.constants.HashZero,
          }),
        `ExceedsMarketCreditCapacity("${delegatedCollateralValue.toString(18, true)}", "${wei(60).add(wei(50)).mul(_ETH_PRICE).toString(18, true)}")`,
        systems().PerpsMarket
      );
    });
  });

  describe('open position with profit', () => {
    before('open 100 eth position', async () => {
      await openPosition({
        systems,
        provider,
        trader: trader1(),
        accountId: 2,
        keeper: keeper(),
        marketId: ethMarket.marketId(),
        sizeDelta: bn(50),
        settlementStrategyId: ethMarket.strategyId(),
        price: _ETH_PRICE.toBN(),
      });
    });

    checkMarketInterestRate();

    describe('close for large profit making market insolvent', () => {
      before('make price higher', async () => {
        await ethMarket.aggregator().mockSetCurrentPrice(bn(10_000));
      });

      before('close position', async () => {
        await openPosition({
          systems,
          provider,
          trader: trader1(),
          accountId: 2,
          keeper: keeper(),
          marketId: ethMarket.marketId(),
          sizeDelta: bn(-100),
          settlementStrategyId: ethMarket.strategyId(),
          price: bn(10_000),
        });
      });

      it('sets util rate at 1', async () => {
        const utilRate = await systems().PerpsMarket.utilizationRate();
        assertBn.equal(utilRate.rate, bn(1));
      });

      checkMarketInterestRate();
    });
  });
});
