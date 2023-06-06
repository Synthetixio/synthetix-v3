import { ethers } from 'ethers';
import { bn, bootstrapMarkets } from '../bootstrap';
import { getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { settleOrder } from '../helpers';
import assert from 'assert';

const ASYNC_OFFCHAIN_ORDER_TYPE = 1;
const ASYNC_OFFCHAIN_URL = 'https://fakeapi.pyth.synthetix.io/';

describe('Commit Offchain Async Order test', () => {
  const { systems, marketOwner, perpsMarkets, provider, trader1, keeper } = bootstrapMarkets({
    synthMarkets: [],
    perpsMarkets: [{ name: 'Ether', token: 'snxETH', price: bn(1000) }],
    traderAccountIds: [2, 3],
  });

  const settlementDelay = 5;
  const settlementWindowDuration = 120;
  const settlementReward = bn(5);
  const priceDeviationTolerance = bn(0.01);

  const feedId = ethers.utils.formatBytes32String('ETH/USD');

  let priceVerificationContract: string;
  let marketId: ethers.BigNumber;

  before('identify actors', async () => {
    marketId = perpsMarkets()[0].marketId();
    priceVerificationContract = systems().MockPyth.address;
  });

  before('create settlement strategy', async () => {
    await systems().PerpsMarket.connect(marketOwner()).addSettlementStrategy(marketId, {
      strategyType: ASYNC_OFFCHAIN_ORDER_TYPE, // OFFCHAIN
      settlementDelay,
      settlementWindowDuration,
      priceVerificationContract,
      feedId,
      url: ASYNC_OFFCHAIN_URL,
      disabled: false,
      settlementReward,
      priceDeviationTolerance,
    });
  });

  before('set skew scale', async () => {
    await systems()
      .PerpsMarket.connect(marketOwner())
      .setFundingParameters(marketId, bn(100_000), bn(0));
  });

  describe('failures', () => {
    it('reverts if market id is incorrect', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(trader1())
          .commitOrder({
            marketId: 1337,
            accountId: 2,
            sizeDelta: bn(1),
            settlementStrategyId: 0,
            acceptablePrice: bn(1000),
            trackingCode: ethers.constants.HashZero,
          }),
        'InvalidMarket("1337")'
      );
    });

    // it('reverts if account is invalid', async () => {
    //   await assertRevert(
    //     systems()
    //       .PerpsMarket.connect(trader1())
    //       .commitOrder({
    //         marketId: marketId,
    //         accountId: 1337,
    //         sizeDelta: bn(1),
    //         settlementStrategyId: 0,
    //         acceptablePrice: bn(1000),
    //         trackingCode: ethers.constants.HashZero,
    //       }),
    //     'InvalidAccount("1337")'
    //   );
    // });

    it('reverts if account not have margin', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(trader1())
          .commitOrder({
            marketId: marketId,
            accountId: 2,
            sizeDelta: bn(1),
            settlementStrategyId: 0,
            acceptablePrice: bn(1000),
            trackingCode: ethers.constants.HashZero,
          }),
        'InsufficientMargin'
      );
    });
  });

  describe('commit order', async () => {
    before('add collateral', async () => {
      await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(10_000));
    });

    let tx: ethers.ContractTransaction;
    let startTime: number;

    before('commit the order', async () => {
      tx = await systems()
        .PerpsMarket.connect(trader1())
        .commitOrder({
          marketId: marketId,
          accountId: 2,
          sizeDelta: bn(1),
          settlementStrategyId: 0,
          acceptablePrice: bn(1000),
          trackingCode: ethers.constants.HashZero,
        });
      startTime = await getTime(provider());
    });

    it('emit event', async () => {
      await assertEvent(
        tx,
        `OrderCommitted(${marketId}, 2, ${ASYNC_OFFCHAIN_ORDER_TYPE}, ${bn(1)}, ${bn(1000)}, ${
          startTime + 5
        }, ${startTime + 5 + 120}, "${
          ethers.constants.HashZero
        }", "${await trader1().getAddress()}")`,
        systems().PerpsMarket
      );
    });

    it('identifies the pending order', async () => {
      const ayncOrderClaim = await systems().PerpsMarket.getAsyncOrderClaim(2, marketId);
      assertBn.equal(ayncOrderClaim.accountId, 2);
      assertBn.equal(ayncOrderClaim.marketId, marketId);
      assertBn.equal(ayncOrderClaim.sizeDelta, bn(1));
      assertBn.equal(ayncOrderClaim.settlementStrategyId, 0);
      assertBn.equal(ayncOrderClaim.settlementTime, startTime + 5);
      assertBn.equal(ayncOrderClaim.acceptablePrice, bn(1000));
      assert.equal(ayncOrderClaim.trackingCode, ethers.constants.HashZero);
    });

    it('reverts if attempt to commit another order for same account and market', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(trader1())
          .commitOrder({
            marketId: marketId,
            accountId: 2,
            sizeDelta: bn(2),
            settlementStrategyId: 0,
            acceptablePrice: bn(1000),
            trackingCode: ethers.constants.HashZero,
          }),
        `OrderAlreadyCommitted("${marketId}", "2")`
      );
    });

    describe('can settle order', () => {
      settleOrder(
        {
          keeper: keeper,
          marketId: () => marketId,
          accountId: () => 2,
          feedId: () => feedId,
          startTime: () => startTime,
          settlementDelay: () => settlementDelay,
          offChainPrice: () => 1000,
        },
        {
          systems,
          provider,
        }
      );

      it('check position is live', async () => {
        const [pnl, funding, size] = await systems().PerpsMarket.getOpenPosition(2, marketId);
        assertBn.equal(pnl, bn(-0.005));
        assertBn.equal(funding, bn(0));
        assertBn.equal(size, bn(1));
      });
    });
  });
});
