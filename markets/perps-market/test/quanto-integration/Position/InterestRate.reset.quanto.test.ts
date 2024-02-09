import { ethers } from 'ethers';
import { PerpsMarket, bn, bootstrapMarkets } from '../../integration/bootstrap';
import { calculateInterestRate, openPosition, getQuantoPositionSize } from '../../integration/helpers';
import { stake } from '@synthetixio/main/test/common';
import Wei, { wei } from '@synthetixio/wei';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';

const _SECONDS_IN_DAY = 24 * 60 * 60;
const _SECONDS_IN_YEAR = 31557600;

const _TRADER_SIZE = wei(getQuantoPositionSize({
  sizeInBaseAsset: bn(20),
  quantoAssetPrice: bn(20_000),
}));
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
  const { systems, perpsMarkets, synthMarkets, superMarketId, provider, trader1, trader3, keeper, owner, poolId } =
    bootstrapMarkets({
      interestRateParams: {
        lowUtilGradient: interestRateParams.lowUtilGradient.toBN(),
        gradientBreakpoint: interestRateParams.gradientBreakpoint.toBN(),
        highUtilGradient: interestRateParams.highUtilGradient.toBN(),
      },
      synthMarkets: [
        {
          name: 'Bitcoin',
          token: 'sBTC',
          buyPrice: bn(20_000),
          sellPrice: bn(20_000),
        }
      ],
      perpsMarkets: [
        {
          lockedOiRatioD18: _ETH_LOCKED_OI_RATIO.toBN(),
          requestedMarketId: 25,
          name: 'Ether',
          token: 'snxETH',
          price: _ETH_PRICE.toBN(),
          quanto: {
            name: 'Bitcoin',
            token: 'BTC',
            price: bn(20_000),
            quantoSynthMarketIndex: 0,
          }
        },
      ],
      traderAccountIds: [2],
    });

  let ethMarket: PerpsMarket;

  // this is so that the creditCapacityD18 for the perps market is the same as in the non-quanto tests
  // as this test includes a synth market, the creditCapacityD18 is split between the two markets
  // halving the amount of credit available to the perps market, which effects the expected interest
  before('stake some extra collateral in the core pool', async () => {
    await stake(
      { Core: systems().Core, CollateralMock: systems().CollateralMock },
      poolId,
      2,
      trader3(),
      bn(1000)
    );
  })

  before('identify actors', async () => {
    ethMarket = perpsMarkets()[0];
  });

  before('trader1 buys 2.5 sBTC', async () => {
    const btcSpotMarketId = synthMarkets()[0].marketId();
    const usdAmount = bn(50_000);
    const minAmountReceived = bn(2.5);
    const referrer = ethers.constants.AddressZero;
    await systems()
      .SpotMarket.connect(trader1())
      .buy(btcSpotMarketId, usdAmount, minAmountReceived, referrer);
  });

  before('add some stop BTC collateral to margin', async () => {
    const btcSpotMarketId = synthMarkets()[0].marketId();
    // approve amount of collateral to be transfered to the market
    await synthMarkets()[0]
      .synth()
      .connect(trader1())
      .approve(systems().PerpsMarket.address, ethers.constants.MaxUint256);
    await systems()
      .PerpsMarket.connect(trader1())
      .modifyCollateral(2, btcSpotMarketId, bn(2.5));
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
        // checked up to here
        const { owedInterest } = await systems().PerpsMarket.getOpenPosition(
          2,
          ethMarket.marketId()
        );
        const expectedInterestBTC = _TRADER1_LOCKED_OI
          .mul(wei(await systems().PerpsMarket.interestRate()))
          .mul(proportionalTime(_SECONDS_IN_DAY));

        trader1InterestAccumulated = trader1InterestAccumulated.add(owedInterest);
        assertBn.near(owedInterest, expectedInterestBTC.toBN(), bn(0.0001));
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
