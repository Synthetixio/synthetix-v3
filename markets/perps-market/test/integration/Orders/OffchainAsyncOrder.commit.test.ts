import { ethers } from 'ethers';
import { bn, bootstrapMarkets } from '../bootstrap';
import { getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { SetCollateralData, depositCollateral, settleOrder } from '../helpers';
import assert from 'assert';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';

const ASYNC_OFFCHAIN_ORDER_TYPE = 1;
const ASYNC_OFFCHAIN_URL = 'https://fakeapi.pyth.synthetix.io/';

describe('Commit Offchain Async Order test', () => {
  const { systems, marketOwner, perpsMarkets, synthMarkets, provider, owner, trader1, keeper } =
    bootstrapMarkets({
      synthMarkets: [
        {
          name: 'Bitcoin',
          token: 'snxBTC',
          buyPrice: bn(10_000),
          sellPrice: bn(10_000),
        },
      ],
      perpsMarkets: [
        {
          name: 'Ether',
          token: 'snxETH',
          price: bn(1000),
          fundingParams: { skewScale: bn(100_000), maxFundingVelocity: bn(0) },
        },
      ],
      traderAccountIds: [2, 3],
      globalConfig: {
        synthDeductionPriority: [
          ethers.BigNumber.from(0), // snxUSD
          ethers.BigNumber.from(2), // snxBTC TODO - this shouldn't be hardcoded
        ],
      },
    });

  const settlementDelay = 5;
  const settlementWindowDuration = 120;
  const settlementReward = bn(5);
  const priceDeviationTolerance = bn(0.01);

  const feedId = ethers.utils.formatBytes32String('ETH/USD');

  let priceVerificationContract: string;
  let ethMarketId: ethers.BigNumber;
  let btcSynthId: ethers.BigNumber;

  before('identify actors', async () => {
    ethMarketId = perpsMarkets()[0].marketId();
    btcSynthId = synthMarkets()[0].marketId();
    priceVerificationContract = systems().MockPyth.address;
  });

  before('owner sets limits to max', async () => {
    await systems()
      .PerpsMarket.connect(owner())
      .setMaxCollateralAmount(btcSynthId, ethers.constants.MaxUint256);
  });

  before('create settlement strategy', async () => {
    await systems().PerpsMarket.connect(marketOwner()).addSettlementStrategy(ethMarketId, {
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
    //         ethMarketId: ethMarketId,
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
            marketId: ethMarketId,
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

  const restoreToCommit = snapshotCheckpoint(provider);

  const testCases: Array<{ name: string; collateralData: SetCollateralData }> = [
    {
      name: 'only snxUSD',
      collateralData: {
        trader: trader1,
        accountId: () => 2,
        trades: [
          {
            synthName: () => 'snxUSD',
            synthMarketId: () => 0,
            synthMarket: synthMarkets()[0].synth,
            marginAmount: () => 0,
            synthAmount: () => bn(10_000),
          },
        ],
      },
    },
    {
      name: 'only snxBTC',
      collateralData: {
        trader: trader1,
        accountId: () => 2,
        trades: [
          {
            synthName: () => 'snxBTC',
            synthMarketId: () => btcSynthId,
            synthMarket: synthMarkets()[0].synth,
            marginAmount: () => bn(10_000),
            synthAmount: () => bn(1),
          },
        ],
      },
    },
    {
      name: 'snxUSD and snxBTC',
      collateralData: {
        trader: trader1,
        accountId: () => 2,
        trades: [
          {
            synthName: () => 'snxUSD',
            synthMarketId: () => 0,
            synthMarket: synthMarkets()[0].synth,
            marginAmount: () => 0,
            synthAmount: () => bn(2), // less than needed to pay for settlementReward
          },
          {
            synthName: () => 'snxBTC',
            synthMarketId: () => btcSynthId,
            synthMarket: synthMarkets()[0].synth,
            marginAmount: () => bn(10_000),
            synthAmount: () => bn(1),
          },
        ],
      },
    },
  ];

  for (const testCase of testCases) {
    describe(`Using ${testCase.name} as collateral`, () => {
      let tx: ethers.ContractTransaction;
      let startTime: number;

      before(restoreToCommit);

      before('add collateral', async () => {
        await depositCollateral(testCase.collateralData, { systems, provider });
      });

      before('commit the order', async () => {
        tx = await systems()
          .PerpsMarket.connect(trader1())
          .commitOrder({
            marketId: ethMarketId,
            accountId: 2,
            sizeDelta: bn(1),
            settlementStrategyId: 0,
            acceptablePrice: bn(1000),
            trackingCode: ethers.constants.HashZero,
          });
        await tx.wait();
        startTime = await getTime(provider());
      });

      it('emit event', async () => {
        await assertEvent(
          tx,
          `OrderCommitted(${ethMarketId}, 2, ${ASYNC_OFFCHAIN_ORDER_TYPE}, ${bn(1)}, ${bn(1000)}, ${
            startTime + 5
          }, ${startTime + 5 + 120}, "${
            ethers.constants.HashZero
          }", "${await trader1().getAddress()}")`,
          systems().PerpsMarket
        );
      });

      it('identifies the pending order', async () => {
        const ayncOrderClaim = await systems().PerpsMarket.getAsyncOrderClaim(2, ethMarketId);
        assertBn.equal(ayncOrderClaim.accountId, 2);
        assertBn.equal(ayncOrderClaim.marketId, ethMarketId);
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
              marketId: ethMarketId,
              accountId: 2,
              sizeDelta: bn(2),
              settlementStrategyId: 0,
              acceptablePrice: bn(1000),
              trackingCode: ethers.constants.HashZero,
            }),
          `OrderAlreadyCommitted("${ethMarketId}", "2")`
        );
      });

      describe('can settle order', () => {
        settleOrder(
          {
            keeper: keeper,
            marketId: () => ethMarketId,
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
          const [pnl, funding, size] = await systems().PerpsMarket.getOpenPosition(2, ethMarketId);
          assertBn.equal(pnl, bn(-0.005));
          assertBn.equal(funding, bn(0));
          assertBn.equal(size, bn(1));
        });

        describe('can commit another order after settlement', () => {
          before('commit the order', async () => {
            tx = await systems()
              .PerpsMarket.connect(trader1())
              .commitOrder({
                marketId: ethMarketId,
                accountId: 2,
                sizeDelta: bn(1),
                settlementStrategyId: 0,
                acceptablePrice: bn(1000),
                trackingCode: ethers.constants.HashZero,
              });
            await tx.wait();
            startTime = await getTime(provider());
          });

          it('emit event', async () => {
            await assertEvent(
              tx,
              `OrderCommitted(${ethMarketId}, 2, ${ASYNC_OFFCHAIN_ORDER_TYPE}, ${bn(1)}, ${bn(
                1000
              )}, ${startTime + 5}, ${startTime + 5 + 120}, "${
                ethers.constants.HashZero
              }", "${await trader1().getAddress()}")`,
              systems().PerpsMarket
            );
          });

          it('identifies the pending order', async () => {
            const ayncOrderClaim = await systems().PerpsMarket.getAsyncOrderClaim(2, ethMarketId);
            assertBn.equal(ayncOrderClaim.accountId, 2);
            assertBn.equal(ayncOrderClaim.marketId, ethMarketId);
            assertBn.equal(ayncOrderClaim.sizeDelta, bn(1));
            assertBn.equal(ayncOrderClaim.settlementStrategyId, 0);
            assertBn.equal(ayncOrderClaim.settlementTime, startTime + 5);
            assertBn.equal(ayncOrderClaim.acceptablePrice, bn(1000));
            assert.equal(ayncOrderClaim.trackingCode, ethers.constants.HashZero);
          });
        });
      });
    });
  }
});
