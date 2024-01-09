import { ethers } from 'ethers';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { DEFAULT_SETTLEMENT_STRATEGY, bn, bootstrapMarkets } from '../bootstrap';
import { openPosition } from '../helpers';
import Wei, { wei } from '@synthetixio/wei';

describe('OffchainAsyncOrder - feeCollector - referrer', () => {
  const _ETH_PRICE = bn(2000);
  const {
    systems,
    superMarketId,
    perpsMarkets,
    signers,
    owner,
    provider,
    trader1,
    trader2,
    keeper,
  } = bootstrapMarkets({
    synthMarkets: [],
    perpsMarkets: [
      {
        requestedMarketId: 25,
        name: 'Ether',
        token: 'snxETH',
        price: _ETH_PRICE,
        // setting to 0 to avoid funding and p/d price change affecting pnl
        fundingParams: { skewScale: bn(10_000), maxFundingVelocity: bn(0) },
        orderFees: {
          makerFee: bn(0.0003), // 3bps
          takerFee: bn(0.0008), // 8bps
        },
      },
    ],
    traderAccountIds: [2, 3],
  });

  let marketId: ethers.BigNumber,
    settlementStrategyId: ethers.BigNumber,
    referrer: ethers.Signer,
    settlementReward: Wei;
  before('identify actors', () => {
    marketId = perpsMarkets()[0].marketId();
    settlementStrategyId = perpsMarkets()[0].strategyId();
    settlementReward = wei(DEFAULT_SETTLEMENT_STRATEGY.settlementReward);
    referrer = signers()[8];
  });

  before('add margin', async () => {
    await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(100_000));
    await systems().PerpsMarket.connect(trader2()).modifyCollateral(3, 0, bn(100_000));
  });

  const feeCollectorRatio = wei(0.25), // 25%
    referrerRatio = wei(0.1); // 10%
  before('set fee collector and referral', async () => {
    await systems().FeeCollectorMock.mockSetFeeRatio(feeCollectorRatio.toBN()); // 25%
    await systems()
      .PerpsMarket.connect(owner())
      .setFeeCollector(systems().FeeCollectorMock.address);
    await systems()
      .PerpsMarket.connect(owner())
      .updateReferrerShare(await referrer.getAddress(), referrerRatio.toBN()); // 10%
  });

  describe('with fee collector/referrer set', () => {
    let expectedFees: Wei,
      expectedToFeeCollector: Wei,
      expectedToReferrer: Wei,
      beforeWithdrawableUsd: Wei;
    const sizeDelta = bn(100);
    before('identify data', async () => {
      beforeWithdrawableUsd = wei(await systems().Core.getWithdrawableMarketUsd(superMarketId()));
      // NOTE: expected fees here does not include settlement reward
      const [fees] = await systems().PerpsMarket.computeOrderFees(
        perpsMarkets()[0].marketId(),
        sizeDelta
      );
      expectedFees = wei(fees);
      expectedToReferrer = expectedFees.mul(referrerRatio);
      expectedToFeeCollector = expectedFees.sub(expectedToReferrer).mul(feeCollectorRatio);
    });

    before('open position', async () => {
      await openPosition({
        systems,
        provider,
        trader: trader1(),
        marketId,
        accountId: 2,
        sizeDelta,
        settlementStrategyId,
        referrer: await referrer.getAddress(),
        price: _ETH_PRICE,
        keeper: keeper(),
      });
    });

    it('properly deducted fees from trader account', async () => {
      assertBn.equal(
        await systems().PerpsMarket.totalCollateralValue(2),
        wei(100_000).sub(expectedFees).sub(settlementReward).toBN()
      );
    });

    it('sent referrer their configured share', async () => {
      assertBn.equal(
        await systems().USD.balanceOf(await referrer.getAddress()),
        expectedToReferrer.toBN()
      );
    });

    it('sent fees to fee collector', async () => {
      assertBn.equal(
        await systems().USD.balanceOf(systems().FeeCollectorMock.address),
        expectedToFeeCollector.toBN()
      );
    });

    it('fees sent from core system', async () => {
      assertBn.equal(
        await systems().Core.getWithdrawableMarketUsd(superMarketId()),
        beforeWithdrawableUsd
          .sub(expectedToReferrer)
          .sub(expectedToFeeCollector)
          .sub(settlementReward)
          .toBN()
      );
    });
  });

  describe('with only fee collector set', () => {
    let expectedToFeeCollector: Wei, previousReferrerBalance: Wei;

    const sizeDelta = bn(-50);
    before('identify data', async () => {
      previousReferrerBalance = wei(await systems().USD.balanceOf(await referrer.getAddress()));
      // NOTE: expected fees here does not include settlement reward
      const [fees] = await systems().PerpsMarket.computeOrderFees(
        perpsMarkets()[0].marketId(),
        sizeDelta
      );
      const expectedFees = wei(fees);
      const currentFeeCollectorBalance = wei(
        await systems().USD.balanceOf(systems().FeeCollectorMock.address)
      );
      expectedToFeeCollector = currentFeeCollectorBalance.add(expectedFees.mul(feeCollectorRatio));
    });

    before('open position', async () => {
      // NOTE: no referrer sent in
      await openPosition({
        systems,
        provider,
        trader: trader2(),
        marketId,
        accountId: 3,
        sizeDelta,
        settlementStrategyId,
        price: _ETH_PRICE,
        keeper: keeper(),
      });
    });

    it('sent no fees to referrer', async () => {
      assertBn.equal(
        await systems().USD.balanceOf(await referrer.getAddress()),
        previousReferrerBalance.toBN()
      );
    });

    it('sent fees to fee collector', async () => {
      assertBn.equal(
        await systems().USD.balanceOf(systems().FeeCollectorMock.address),
        expectedToFeeCollector.toBN()
      );
    });
  });

  describe('with fee collector ratio set to 0%', () => {
    before('set fee collector to 0%', async () => {
      await systems().FeeCollectorMock.mockSetFeeRatio(0);
    });

    let expectedToReferrer: Wei, previousFeeCollectorBalance: Wei;
    const sizeDelta = bn(20);
    before('identify data', async () => {
      previousFeeCollectorBalance = wei(
        await systems().USD.balanceOf(systems().FeeCollectorMock.address)
      );
      const [orderFees] = await systems().PerpsMarket.computeOrderFees(
        perpsMarkets()[0].marketId(),
        sizeDelta
      );
      // NOTE: expected fees here does not include settlement reward
      const expectedFees = wei(orderFees);
      const currentReferrerBalance = wei(
        await systems().USD.balanceOf(await referrer.getAddress())
      );
      expectedToReferrer = currentReferrerBalance.add(expectedFees.mul(referrerRatio));
    });

    before('open position', async () => {
      await openPosition({
        systems,
        provider,
        trader: trader1(),
        marketId,
        accountId: 2,
        sizeDelta,
        referrer: await referrer.getAddress(),
        settlementStrategyId,
        price: _ETH_PRICE,
        keeper: keeper(),
      });
    });

    it('sent fees to referrer', async () => {
      assertBn.equal(
        await systems().USD.balanceOf(await referrer.getAddress()),
        expectedToReferrer.toBN()
      );
    });

    it('sent fees to fee collector', async () => {
      assertBn.equal(
        await systems().USD.balanceOf(systems().FeeCollectorMock.address),
        previousFeeCollectorBalance.toBN()
      );
    });
  });

  describe('fee collector set to above 100%', () => {
    before(async () => {
      await systems().FeeCollectorMock.mockSetFeeRatio(bn(1.25));
    });

    let expectedToReferrer: Wei, expectedToFeeCollector: Wei;
    const sizeDelta = bn(25);
    before('identify data', async () => {
      const [orderFees] = await systems().PerpsMarket.computeOrderFees(
        perpsMarkets()[0].marketId(),
        sizeDelta
      );
      // NOTE: expected fees here does not include settlement reward
      const expectedFees = wei(orderFees);
      const currentFeeCollectorBalance = wei(
        await systems().USD.balanceOf(systems().FeeCollectorMock.address)
      );
      const currentReferrerBalance = wei(
        await systems().USD.balanceOf(await referrer.getAddress())
      );
      expectedToReferrer = currentReferrerBalance.add(expectedFees.mul(referrerRatio));
      // rest of the fees go to fee collector
      expectedToFeeCollector = currentFeeCollectorBalance
        .add(expectedFees)
        .sub(expectedFees.mul(referrerRatio));
    });

    before('open position', async () => {
      await openPosition({
        systems,
        provider,
        trader: trader1(),
        marketId,
        accountId: 2,
        sizeDelta,
        referrer: await referrer.getAddress(),
        settlementStrategyId,
        price: _ETH_PRICE,
        keeper: keeper(),
      });
    });

    it('sent fees to referrer', async () => {
      assertBn.equal(
        await systems().USD.balanceOf(await referrer.getAddress()),
        expectedToReferrer.toBN()
      );
    });

    it('sent fees to fee collector', async () => {
      assertBn.equal(
        await systems().USD.balanceOf(systems().FeeCollectorMock.address),
        expectedToFeeCollector.toBN()
      );
    });
  });

  describe('only referrer set', () => {
    before('set fee collector to zero address', async () => {
      await systems().PerpsMarket.setFeeCollector(ethers.constants.AddressZero);
    });

    let expectedToReferrer: Wei, previousFeeCollectorBalance: Wei;
    const sizeDelta = bn(75);
    before('identify data', async () => {
      previousFeeCollectorBalance = wei(
        await systems().USD.balanceOf(systems().FeeCollectorMock.address)
      );
      // NOTE: expected fees here does not include settlement reward
      const [fees] = await systems().PerpsMarket.computeOrderFees(
        perpsMarkets()[0].marketId(),
        sizeDelta
      );
      const expectedFees = wei(fees);
      const currentReferrerBalance = wei(
        await systems().USD.balanceOf(await referrer.getAddress())
      );
      expectedToReferrer = currentReferrerBalance.add(expectedFees.mul(referrerRatio));
    });

    before('open position', async () => {
      await openPosition({
        systems,
        provider,
        trader: trader2(),
        marketId,
        accountId: 3,
        sizeDelta,
        referrer: await referrer.getAddress(),
        settlementStrategyId,
        price: _ETH_PRICE,
        keeper: keeper(),
      });
    });

    it('sent fees to referrer', async () => {
      assertBn.equal(
        await systems().USD.balanceOf(await referrer.getAddress()),
        expectedToReferrer.toBN()
      );
    });

    it('sent fees to fee collector', async () => {
      assertBn.equal(
        await systems().USD.balanceOf(systems().FeeCollectorMock.address),
        previousFeeCollectorBalance.toBN()
      );
    });
  });

  describe('update referrer share failures', () => {
    it('reverts when referrer address is 0x', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(owner())
          .updateReferrerShare(ethers.constants.AddressZero, bn(0.1)),
        'ZeroAddress'
      );
    });

    it('reverts when set above 100%', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(owner())
          .updateReferrerShare(await referrer.getAddress(), bn(1.1)),
        'InvalidReferrerShareRatio'
      );
    });
  });

  describe('referrer share set to 0', () => {
    before(async () => {
      await systems()
        .PerpsMarket.connect(owner())
        .updateReferrerShare(await referrer.getAddress(), 0);
    });

    let previousReferrerBalance: Wei,
      previousFeeCollectorBalance: Wei,
      previousWithdrawableUsd: Wei;
    const sizeDelta = bn(50);
    before('identify data', async () => {
      previousFeeCollectorBalance = wei(
        await systems().USD.balanceOf(systems().FeeCollectorMock.address)
      );
      previousReferrerBalance = wei(await systems().USD.balanceOf(await referrer.getAddress()));
      previousWithdrawableUsd = wei(await systems().Core.getWithdrawableMarketUsd(superMarketId()));
    });

    before('open position', async () => {
      await openPosition({
        systems,
        provider,
        trader: trader2(),
        marketId,
        accountId: 3,
        sizeDelta,
        referrer: await referrer.getAddress(),
        settlementStrategyId,
        price: _ETH_PRICE,
        keeper: keeper(),
      });
    });

    it('sent fees to referrer', async () => {
      assertBn.equal(
        await systems().USD.balanceOf(await referrer.getAddress()),
        previousReferrerBalance.toBN()
      );
    });

    it('sent fees to fee collector', async () => {
      assertBn.equal(
        await systems().USD.balanceOf(systems().FeeCollectorMock.address),
        previousFeeCollectorBalance.toBN()
      );
    });

    it('kept fees in the core system', async () => {
      assertBn.equal(
        await systems().Core.getWithdrawableMarketUsd(superMarketId()),
        previousWithdrawableUsd.sub(settlementReward).toBN()
      );
    });
  });
});
