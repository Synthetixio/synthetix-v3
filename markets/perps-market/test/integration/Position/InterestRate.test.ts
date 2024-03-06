import { PerpsMarket, bn, bootstrapMarkets } from '../bootstrap';
import { calculateInterestRate, openPosition } from '../helpers';
import Wei, { wei } from '@synthetixio/wei';
import { ethers } from 'ethers';
import { fastForwardTo, getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';

const _SECONDS_IN_DAY = 24 * 60 * 60;
const _SECONDS_IN_YEAR = 31557600;

const _TRADER_SIZE = wei(20);
const _ETH_PRICE = wei(2000);
const _BTC_PRICE = wei(30_000);
const _ETH_LOCKED_OI_RATIO = wei(1);
const _BTC_LOCKED_OI_RATIO = wei(0.5);

const _TRADER1_LOCKED_OI = _TRADER_SIZE.mul(_ETH_PRICE).mul(_ETH_LOCKED_OI_RATIO);

const interestRateParams = {
  lowUtilGradient: wei(0.0003),
  gradientBreakpoint: wei(0.75),
  highUtilGradient: wei(0.01),
};

const proportionalTime = (seconds: number) => wei(seconds).div(_SECONDS_IN_YEAR);

describe('Position - interest rates', () => {
  const { systems, perpsMarkets, superMarketId, provider, trader1, trader2, keeper, staker } =
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

  before('identify actors', async () => {
    ethMarket = perpsMarkets()[0];
    btcMarket = perpsMarkets()[1];
  });

  before('add collateral to margin', async () => {
    await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(50_000));
    await systems().PerpsMarket.connect(trader2()).modifyCollateral(3, 0, bn(200_000));
  });

  const checkMarketInterestRate = () => {
    let currentInterestRate: Wei;
    it('has correct interest rate', async () => {
      const withdrawableUsd = wei(await systems().Core.getWithdrawableMarketUsd(superMarketId()));
      const totalCollateralValue = wei(await systems().PerpsMarket.totalGlobalCollateralValue());
      const delegatedCollateral = withdrawableUsd.sub(totalCollateralValue);
      const minCredit = wei(await systems().PerpsMarket.minimumCredit(superMarketId()));

      const utilRate = minCredit.div(delegatedCollateral);
      currentInterestRate = calculateInterestRate(utilRate, interestRateParams);
      assertBn.near(
        await systems().PerpsMarket.interestRate(),
        currentInterestRate.toBN(),
        bn(0.0001)
      );
      const {
        rate: expectedUtilizationRate,
        delegatedCollateral: expectedDelegatedCollateralValue,
      } = await systems().PerpsMarket.utilizationRate();
      assertBn.near(expectedUtilizationRate, utilRate.toBN(), bn(0.0001));
      assertBn.equal(expectedDelegatedCollateralValue, delegatedCollateral.toBN());
    });

    return {
      currentInterestRate: () => currentInterestRate,
    };
  };

  let trader1OpenPositionTime: number, trader2OpenPositionTime: number;
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

  let trader1InterestAccumulated: Wei = wei(0),
    lastTimeInterestAccrued: number;

  describe('a day passes by', () => {
    before('fast forward time', async () => {
      await fastForwardTo(trader1OpenPositionTime + _SECONDS_IN_DAY, provider());
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
        lastTimeInterestAccrued = trader1OpenPositionTime + _SECONDS_IN_DAY;
        assertBn.near(owedInterest, expectedInterest.toBN(), bn(0.0001));
      });
    });
  });

  let newPositionSize = 0;
  [
    { size: -10, time: _SECONDS_IN_DAY },
    { size: 115, time: _SECONDS_IN_DAY },
    { size: -70, time: _SECONDS_IN_DAY * 0.25 },
    { size: -25, time: _SECONDS_IN_DAY * 2 },
    { size: 5, time: _SECONDS_IN_DAY * 0.1 },
  ].forEach(({ size, time }) => {
    describe('new trader enters', () => {
      let previousMarketInterestRate: Wei, settleTrader2Txn: ethers.ContractTransaction;
      before('identify interest rate', async () => {
        previousMarketInterestRate = wei(await systems().PerpsMarket.interestRate());
      });

      before('trader2 changes OI', async () => {
        newPositionSize += size;
        ({ settleTime: trader2OpenPositionTime, settleTx: settleTrader2Txn } = await openPosition({
          systems,
          provider,
          trader: trader2(),
          accountId: 3,
          keeper: keeper(),
          marketId: btcMarket.marketId(),
          sizeDelta: bn(size),
          settlementStrategyId: btcMarket.strategyId(),
          price: _BTC_PRICE.toBN(),
        }));

        await assertEvent(settleTrader2Txn, 'InterestCharged(3', systems().PerpsMarket);
      });

      before('accumulate trader 1 interest', async () => {
        const timeSinceLastAccrued = trader2OpenPositionTime - lastTimeInterestAccrued;
        // track interest accrued during new order
        const newInterestAccrued = _TRADER1_LOCKED_OI
          .mul(previousMarketInterestRate)
          .mul(proportionalTime(timeSinceLastAccrued));
        trader1InterestAccumulated = trader1InterestAccumulated.add(newInterestAccrued);
      });

      checkMarketInterestRate();
    });

    describe(`${time} seconds pass`, () => {
      let normalizedTime: Wei;
      before('fast forward time', async () => {
        await fastForwardTo(trader2OpenPositionTime + time, provider());

        const blockTime = await getTime(provider());
        lastTimeInterestAccrued = blockTime;
        normalizedTime = proportionalTime(blockTime - trader2OpenPositionTime);
      });

      it('accrued correct interest for trader 1', async () => {
        const { owedInterest } = await systems().PerpsMarket.getOpenPosition(
          2,
          ethMarket.marketId()
        );

        const newInterestAccrued = _TRADER1_LOCKED_OI
          .mul(wei(await systems().PerpsMarket.interestRate()))
          .mul(normalizedTime);
        trader1InterestAccumulated = trader1InterestAccumulated.add(newInterestAccrued);
        assertBn.near(owedInterest, trader1InterestAccumulated.toBN(), bn(0.0001));
      });

      it('accrued correct interest for trader 2', async () => {
        const { owedInterest } = await systems().PerpsMarket.getOpenPosition(
          3,
          btcMarket.marketId()
        );

        const trader2Oi = wei(Math.abs(newPositionSize)).mul(_BTC_PRICE).mul(_BTC_LOCKED_OI_RATIO);

        const expectedTrader2Interest = trader2Oi
          .mul(wei(await systems().PerpsMarket.interestRate()))
          .mul(normalizedTime);
        assertBn.near(owedInterest, expectedTrader2Interest.toBN(), bn(0.00001));
      });
    });
  });

  describe('change delegated collateral and manual update', () => {
    let previousMarketInterestRate: Wei, marketUpdateTime: number;
    before('identify interest rate', async () => {
      previousMarketInterestRate = wei(await systems().PerpsMarket.interestRate());
    });

    before('undelegate 10%', async () => {
      const currentCollateralAmount = await systems().Core.getPositionCollateral(
        1,
        1,
        systems().CollateralMock.address
      );
      // current assumption = 1000 collateral at $2000 price == $2M delegated collateral value
      await systems()
        .Core.connect(staker())
        .delegateCollateral(
          1,
          1,
          systems().CollateralMock.address,
          wei(currentCollateralAmount).mul(wei(0.9)).toBN(),
          ethers.utils.parseEther('1')
        );
    });

    let updateTxn: ethers.providers.TransactionResponse;
    before('call manual update', async () => {
      updateTxn = await systems().PerpsMarket.updateInterestRate();
      marketUpdateTime = await getTime(provider());
    });

    before('accumulate trader 1 interest', async () => {
      const timeSinceLastAccrued = marketUpdateTime - lastTimeInterestAccrued;
      // track interest accrued during new order
      const newInterestAccrued = _TRADER1_LOCKED_OI
        .mul(previousMarketInterestRate)
        .mul(proportionalTime(timeSinceLastAccrued));
      trader1InterestAccumulated = trader1InterestAccumulated.add(newInterestAccrued);
    });

    const { currentInterestRate } = checkMarketInterestRate();

    it('emits event', async () => {
      await assertEvent(
        updateTxn,
        `InterestRateUpdated(${superMarketId()}, ${currentInterestRate().toString(
          undefined,
          true
        )})`,
        systems().PerpsMarket
      );
    });

    describe('check trader interest after day passes', () => {
      let normalizedTime: Wei;
      before('fast forward time', async () => {
        await fastForwardTo(marketUpdateTime + _SECONDS_IN_DAY * 50, provider());

        const blockTime = await getTime(provider());
        lastTimeInterestAccrued = blockTime;
        normalizedTime = proportionalTime(blockTime - marketUpdateTime);
      });

      it('accrued correct interest for trader 1', async () => {
        const { owedInterest } = await systems().PerpsMarket.getOpenPosition(
          2,
          ethMarket.marketId()
        );

        const newInterestAccrued = _TRADER1_LOCKED_OI
          .mul(wei(await systems().PerpsMarket.interestRate()))
          .mul(normalizedTime);
        trader1InterestAccumulated = trader1InterestAccumulated.add(newInterestAccrued);
        assertBn.near(owedInterest, trader1InterestAccumulated.toBN(), bn(0.0001));
      });
    });
  });
});
