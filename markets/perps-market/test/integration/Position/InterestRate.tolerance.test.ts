import { PerpsMarket, bn, bootstrapMarkets } from '../bootstrap';
import { calculateInterestRate, openPosition } from '../helpers';
import Wei, { wei } from '@synthetixio/wei';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';

const _TRADER_ETH_SIZE = wei(20);
const _TRADER_BTC_SIZE = wei(-10);
const _ETH_PRICE = wei(2000);
const _ETH_MONTHLY_PRICE = wei(2100);
const _BTC_PRICE = wei(30_000);
const _BTC_MONTHLY_PRICE = wei(31_000);
const _ETH_LOCKED_OI_RATIO = wei(1);
const _BTC_LOCKED_OI_RATIO = wei(1);

const interestRateParams = {
  lowUtilGradient: wei(0.0003),
  gradientBreakpoint: wei(0.75),
  highUtilGradient: wei(0.01),
};

const calculateMinCredit = (useMonthlyPrice: boolean) => {
  const ethNotional = _TRADER_ETH_SIZE.abs().mul(useMonthlyPrice ? _ETH_MONTHLY_PRICE : _ETH_PRICE);
  const btcNotional = _TRADER_BTC_SIZE.abs().mul(useMonthlyPrice ? _BTC_MONTHLY_PRICE : _BTC_PRICE);
  return ethNotional.add(btcNotional);
};

describe('InterestRate.tolerance', () => {
  const { systems, perpsMarkets, superMarketId, provider, trader1, trader2, keeper } =
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
        {
          lockedOiRatioD18: _BTC_LOCKED_OI_RATIO.toBN(),
          requestedMarketId: 50,
          name: 'Bitcoin',
          token: 'snxBTC',
          price: _BTC_PRICE.toBN(),
        },
      ],
      traderAccountIds: [2, 3],
    });

  let ethMarket: PerpsMarket, btcMarket: PerpsMarket;

  before('setup', async () => {
    ethMarket = perpsMarkets()[0];
    btcMarket = perpsMarkets()[1];

    // add collateral to margin
    await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(50_000));
    await systems().PerpsMarket.connect(trader2()).modifyCollateral(3, 0, bn(200_000));

    // set monthly price
    await ethMarket.aggregator().mockSetMonthlyTolerancePrice(_ETH_MONTHLY_PRICE.toBN());
    await btcMarket.aggregator().mockSetMonthlyTolerancePrice(_BTC_MONTHLY_PRICE.toBN());
  });

  before('positions open', async () => {
    await openPosition({
      systems,
      provider,
      trader: trader1(),
      accountId: 2,
      keeper: keeper(),
      marketId: ethMarket.marketId(),
      sizeDelta: _TRADER_ETH_SIZE.toBN(),
      settlementStrategyId: ethMarket.strategyId(),
      price: _ETH_PRICE.toBN(),
    });

    await openPosition({
      systems,
      provider,
      trader: trader2(),
      accountId: 3,
      keeper: keeper(),
      marketId: btcMarket.marketId(),
      sizeDelta: _TRADER_BTC_SIZE.toBN(),
      settlementStrategyId: btcMarket.strategyId(),
      price: _BTC_PRICE.toBN(),
    });
  });

  const checkMarketInterestRate = (withMontlyTolerance: boolean) => {
    let currentInterestRate: Wei;
    it('has correct interest rate', async () => {
      const withdrawableUsd = wei(await systems().Core.getWithdrawableMarketUsd(superMarketId()));
      const totalCollateralValue = wei(await systems().PerpsMarket.totalGlobalCollateralValue());
      const delegatedCollateral = withdrawableUsd.sub(totalCollateralValue);

      const minCredit = calculateMinCredit(withMontlyTolerance);

      const utilRate = minCredit.div(delegatedCollateral);
      currentInterestRate = calculateInterestRate(utilRate, interestRateParams);
      const actualInterestRate = await systems().PerpsMarket.interestRate();
      assertBn.near(actualInterestRate, currentInterestRate.toBN(), bn(0.0001));
    });

    return {
      currentInterestRate: () => currentInterestRate,
    };
  };

  checkMarketInterestRate(true);

  describe('on manual update', () => {
    before('update interest rate', async () => {
      await systems().PerpsMarket.updateInterestRate();
    });

    checkMarketInterestRate(false);
  });
});
