import { ethers } from 'ethers';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { DEFAULT_SETTLEMENT_STRATEGY, bn, bootstrapMarkets } from '../bootstrap';
import { openPosition } from '../helpers';
import Wei, { wei } from '@synthetixio/wei';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';

describe('OffchainAsyncOrder - feeCollector - zero fees', () => {
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

  const feeCollectorRatio = wei(0.25), // 25%
    referrerRatio = wei(0.1); // 10%
  before('setup tests', async () => {
    // Add collateral
    await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(100_000));
    await systems().PerpsMarket.connect(trader2()).modifyCollateral(3, 0, bn(100_000));

    // setfee collector and referral
    await systems().FeeCollectorMock.mockSetFeeRatio(feeCollectorRatio.toBN()); // 25%
    await systems()
      .PerpsMarket.connect(owner())
      .setFeeCollector(systems().FeeCollectorMock.address);
    await systems()
      .PerpsMarket.connect(owner())
      .updateReferrerShare(await referrer.getAddress(), referrerRatio.toBN()); // 10%
  });

  const restoreToSetup = snapshotCheckpoint(provider);

  it('initial check with fees set', async () => {
    const sizeDelta = bn(100);

    // Identify data
    const beforeWithdrawableUsd = wei(
      await systems().Core.getWithdrawableMarketUsd(superMarketId())
    );
    // NOTE: expected fees here does not include settlement reward
    const [fees] = await systems().PerpsMarket.computeOrderFees(
      perpsMarkets()[0].marketId(),
      sizeDelta
    );
    const expectedFees = wei(fees);
    const expectedToReferrer = expectedFees.mul(referrerRatio);
    const expectedToFeeCollector = expectedFees.sub(expectedToReferrer).mul(feeCollectorRatio);

    // Open position
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

    // Properly deducted fees from trader account
    assertBn.equal(
      await systems().PerpsMarket.totalCollateralValue(2),
      wei(100_000).sub(expectedFees).sub(settlementReward).toBN()
    );

    // Sent referrer their configured share
    assertBn.equal(
      await systems().USD.balanceOf(await referrer.getAddress()),
      expectedToReferrer.toBN()
    );

    // Sent fees to fee collector
    assertBn.equal(
      await systems().USD.balanceOf(systems().FeeCollectorMock.address),
      expectedToFeeCollector.toBN()
    );

    // Fees sent from core system
    assertBn.equal(
      await systems().Core.getWithdrawableMarketUsd(superMarketId()),
      beforeWithdrawableUsd
        .sub(expectedToReferrer)
        .sub(expectedToFeeCollector)
        .sub(settlementReward)
        .toBN()
    );
  });

  const nonZeroMakerFee = bn(0.0003); // 3bps
  const nonZeroTakerFee = bn(0.0008); // 8bps

  describe('taker fee set to 0', () => {
    before(restoreToSetup);
    before(async () => {
      await systems().PerpsMarket.connect(owner()).setOrderFees(marketId, nonZeroMakerFee, 0);
    });
    it('allows for long and short positions (maker and taker)', async () => {
      // Open LONG position
      let sizeDelta = bn(100);

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

      // Open SHORT position
      sizeDelta = bn(-100);

      await openPosition({
        systems,
        provider,
        trader: trader2(),
        marketId,
        accountId: 3,
        sizeDelta,
        settlementStrategyId,
        referrer: await referrer.getAddress(),
        price: _ETH_PRICE,
        keeper: keeper(),
      });
    });
  });
  describe('maker fee set to 0', () => {
    before(restoreToSetup);
    before(async () => {
      await systems().PerpsMarket.connect(owner()).setOrderFees(marketId, 0, nonZeroTakerFee);
    });
    it('allows for long and short positions (maker and taker)', async () => {
      // Open LONG position
      let sizeDelta = bn(100);

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

      // Open SHORT position
      sizeDelta = bn(-100);

      await openPosition({
        systems,
        provider,
        trader: trader2(),
        marketId,
        accountId: 3,
        sizeDelta,
        settlementStrategyId,
        referrer: await referrer.getAddress(),
        price: _ETH_PRICE,
        keeper: keeper(),
      });
    });
  });
  describe('both fee set to 0', () => {
    before(restoreToSetup);
    before(async () => {
      await systems().PerpsMarket.connect(owner()).setOrderFees(marketId, 0, 0);
    });
    it('allows for long and short positions (maker and taker)', async () => {
      // Open LONG position
      let sizeDelta = bn(100);

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

      // Open SHORT position
      sizeDelta = bn(-100);

      await openPosition({
        systems,
        provider,
        trader: trader2(),
        marketId,
        accountId: 3,
        sizeDelta,
        settlementStrategyId,
        referrer: await referrer.getAddress(),
        price: _ETH_PRICE,
        keeper: keeper(),
      });
    });
  });
});
