import { PerpsMarket, bn, bootstrapMarkets } from '../bootstrap';
import { calculateInterestRate, openPosition } from '../helpers';
import Wei, { wei } from '@synthetixio/wei';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';

const _SECONDS_IN_DAY = 24 * 60 * 60;
const _SECONDS_IN_YEAR = 31557600;

const _TRADER_SIZE = wei(20);
const _ETH_PRICE = wei(2000);
const _ETH_LOCKED_OI_RATIO = wei(1);

const _TRADER1_LOCKED_OI = _TRADER_SIZE.mul(_ETH_PRICE).mul(_ETH_LOCKED_OI_RATIO);

const interestRateParams = {
  lowUtilGradient: wei(0.0005),
  gradientBreakpoint: wei(0.7),
  highUtilGradient: wei(0.02),
};

const proportionalTime = (seconds: number) => wei(seconds).div(_SECONDS_IN_YEAR);

// This test ensures interest accrued is accurately reflected even if the interest rate is turned off
// at a later time.
describe('Position - interest rates - reset', () => {
  const { systems, perpsMarkets, superMarketId, provider, trader1, keeper, owner } =
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
    it('has correct interest rate', async () => {
      const withdrawableUsd = wei(await systems().Core.getWithdrawableMarketUsd(superMarketId()));
      const totalCollateralValue = wei(await systems().PerpsMarket.totalGlobalCollateralValue());
      const delegatedCollateral = withdrawableUsd.sub(totalCollateralValue);
      const minCredit = wei(await systems().PerpsMarket.minimumCredit(superMarketId()));

      const utilRate = minCredit.div(delegatedCollateral);
      const currentInterestRate = calculateInterestRate(utilRate, interestRateParams);
      assertBn.near(
        await systems().PerpsMarket.interestRate(),
        currentInterestRate.toBN(),
        bn(0.0001)
      );
      const { rate: expectedUtilizationRate } = await systems().PerpsMarket.utilizationRate();
      assertBn.near(expectedUtilizationRate, utilRate.toBN(), bn(0.0001));

      const expectedInterestRate = calculateInterestRate(utilRate, interestRateParams);

      assertBn.near(
        await systems().PerpsMarket.interestRate(),
        expectedInterestRate.toBN(),
        bn(0.0001)
      );
    });
  };

  let trader1OpenPositionTime: number;
  // trader 1
  before('open 20 eth position', async () => {
    ({ settleTime: trader1OpenPositionTime } = await openPosition({
      systems,
      provider,
      trader: trader1(),
      accountId: 2,
      keeper: keeper(),
      marketId: ethMarket.marketId(),
      sizeDelta: _TRADER_SIZE.toBN(),
      settlementStrategyId: ethMarket.strategyId(),
      price: _ETH_PRICE.toBN(),
    }));
  });

  checkMarketInterestRate();

  let trader1InterestAccumulated: Wei = wei(0);

  describe('one day later', () => {
    before('fast forward time', async () => {
      await fastForwardTo(trader1OpenPositionTime + _SECONDS_IN_DAY, provider());
    });

    before('manual interest rate update', async () => {
      await systems().PerpsMarket.updateInterestRate();
    });

    describe('check trader 1 interest', () => {
      it('has correct interest rate', async () => {
        const { owedInterest } = await systems().PerpsMarket.getOpenPosition(
          2,
          ethMarket.marketId()
        );
        const expectedInterest = _TRADER1_LOCKED_OI
          .mul(wei(await systems().PerpsMarket.interestRate()))
          .mul(proportionalTime(_SECONDS_IN_DAY));
        trader1InterestAccumulated = trader1InterestAccumulated.add(owedInterest);
        assertBn.near(owedInterest, expectedInterest.toBN(), bn(0.0001));
      });
    });
  });

  describe('one more day later', () => {
    before('fast forward time', async () => {
      await fastForwardTo(trader1OpenPositionTime + _SECONDS_IN_DAY * 2, provider());
    });

    before('set interest params to 0', async () => {
      await systems().PerpsMarket.connect(owner()).setInterestRateParameters(0, 0, 0);
    });

    before('manual update of interest rate', async () => {
      await systems().PerpsMarket.updateInterestRate();
    });

    it('correctly accrues interest prior to updated interest params', async () => {
      const { owedInterest } = await systems().PerpsMarket.getOpenPosition(2, ethMarket.marketId());
      assertBn.near(owedInterest, trader1InterestAccumulated.toBN(), bn(0.0001));
    });
  });
});
