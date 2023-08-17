import { ethers } from 'ethers';
import { DEFAULT_SETTLEMENT_STRATEGY, bn, bootstrapMarkets } from '../bootstrap';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { SynthMarkets } from '@synthetixio/spot-market/test/common';
import { DepositCollateralData, depositCollateral } from '../helpers';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { getTxTime } from '@synthetixio/core-utils/src/utils/hardhat/rpc';
import { calculateFillPrice } from '../helpers/fillPrice';
import { wei } from '@synthetixio/wei';
import { calcCurrentFundingVelocity } from '../helpers/funding-calcs';

describe('Settle Offchain Async Order test', () => {
  const { systems, perpsMarkets, synthMarkets, provider, trader1, keeper } = bootstrapMarkets({
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
        requestedMarketId: 25,
        name: 'Ether',
        token: 'snxETH',
        price: bn(1000),
        fundingParams: { skewScale: bn(100_000), maxFundingVelocity: bn(10) },
      },
    ],
    traderAccountIds: [2, 3],
  });
  let ethMarketId: ethers.BigNumber;
  let btcSynth: SynthMarkets[number];

  before('identify actors', async () => {
    ethMarketId = perpsMarkets()[0].marketId();
    btcSynth = synthMarkets()[0];
  });

  describe('failures before commiting orders', () => {
    describe('using settle', () => {
      it('reverts if account id is incorrect (not valid order)', async () => {
        await assertRevert(
          systems().PerpsMarket.connect(trader1()).settle(1337),
          'OrderNotValid()'
        );
      });

      it('reverts if order was not settled before (not valid order)', async () => {
        await assertRevert(systems().PerpsMarket.connect(trader1()).settle(2), 'OrderNotValid()');
      });
    });

    describe('using settlePythOrder', () => {
      let pythPriceData: string, extraData: string, updateFee: ethers.BigNumber;
      before('get some pyth price data and fee', async () => {
        const startTime = Math.floor(Date.now() / 1000);

        // Get the latest price
        pythPriceData = await systems().MockPyth.createPriceFeedUpdateData(
          DEFAULT_SETTLEMENT_STRATEGY.feedId,
          1000_0000,
          1,
          -4,
          1000_0000,
          1,
          startTime + 6
        );
        updateFee = await systems().MockPyth.getUpdateFee([pythPriceData]);
      });

      it('reverts if account id is incorrect (not valid order)', async () => {
        extraData = ethers.utils.defaultAbiCoder.encode(['uint128'], [1337]);
        await assertRevert(
          systems()
            .PerpsMarket.connect(keeper())
            .settlePythOrder(pythPriceData, extraData, { value: updateFee }),
          'OrderNotValid()'
        );
      });

      it('reverts if order was not settled before (not valid order)', async () => {
        extraData = ethers.utils.defaultAbiCoder.encode(['uint128'], [2]);
        await assertRevert(
          systems()
            .PerpsMarket.connect(keeper())
            .settlePythOrder(pythPriceData, extraData, { value: updateFee }),
          'OrderNotValid()'
        );
      });
    });
  });

  const restoreToCommit = snapshotCheckpoint(provider);

  const testCases: Array<{ name: string; collateralData: DepositCollateralData }> = [
    {
      name: 'only snxUSD',
      collateralData: {
        systems,
        trader: trader1,
        accountId: () => 2,
        collaterals: [
          {
            snxUSDAmount: () => bn(10_000),
          },
        ],
      },
    },
    {
      name: 'only snxBTC',
      collateralData: {
        systems,
        trader: trader1,
        accountId: () => 2,
        collaterals: [
          {
            synthMarket: () => btcSynth,
            snxUSDAmount: () => bn(10_000),
          },
        ],
      },
    },
    {
      name: 'snxUSD and snxBTC',
      collateralData: {
        systems,
        trader: trader1,
        accountId: () => 2,
        collaterals: [
          {
            snxUSDAmount: () => bn(2), // less than needed to pay for settlementReward
          },
          {
            synthMarket: () => btcSynth,
            snxUSDAmount: () => bn(10_000),
          },
        ],
      },
    },
  ];

  for (let idx = 0; idx < testCases.length; idx++) {
    const testCase = testCases[idx];
    describe(`Using ${testCase.name} as collateral`, () => {
      let pythCallData: string, extraData: string, updateFee: ethers.BigNumber;

      let tx: ethers.ContractTransaction;
      let startTime: number;

      before(restoreToCommit);

      before('add collateral', async () => {
        await depositCollateral(testCase.collateralData);
      });

      before('commit the order', async () => {
        tx = await systems()
          .PerpsMarket.connect(trader1())
          .commitOrder({
            marketId: ethMarketId,
            accountId: 2,
            sizeDelta: bn(1),
            settlementStrategyId: 0,
            acceptablePrice: bn(1050), // 5% slippage
            referrer: ethers.constants.AddressZero,
            trackingCode: ethers.constants.HashZero,
          });
        startTime = await getTxTime(provider(), tx);
      });

      before('setup bytes data', () => {
        extraData = ethers.utils.defaultAbiCoder.encode(['uint128'], [2]);
        pythCallData = ethers.utils.solidityPack(
          ['bytes32', 'uint64'],
          [
            DEFAULT_SETTLEMENT_STRATEGY.feedId,
            startTime + DEFAULT_SETTLEMENT_STRATEGY.settlementDelay,
          ]
        );
      });

      const restoreBeforeSettle = snapshotCheckpoint(provider);

      describe('attempts to settle before settlement time', () => {
        before(restoreBeforeSettle);

        it('with settle', async () => {
          await assertRevert(
            systems().PerpsMarket.connect(trader1()).settle(2),
            'SettlementWindowNotOpen'
          );
        });

        it('with settlePythOrder', async () => {
          const validPythPriceData = await systems().MockPyth.createPriceFeedUpdateData(
            DEFAULT_SETTLEMENT_STRATEGY.feedId,
            1000_0000,
            1,
            -4,
            1000_0000,
            1,
            startTime + 6
          );
          updateFee = await systems().MockPyth.getUpdateFee([validPythPriceData]);
          await assertRevert(
            systems()
              .PerpsMarket.connect(keeper())
              .settlePythOrder(validPythPriceData, extraData, { value: updateFee }),
            'SettlementWindowNotOpen'
          );
        });
      });

      describe('attempts to settle after settlement window', () => {
        before(restoreBeforeSettle);

        before('fast forward to past settlement window', async () => {
          // fast forward to settlement
          await fastForwardTo(
            startTime +
              DEFAULT_SETTLEMENT_STRATEGY.settlementDelay +
              DEFAULT_SETTLEMENT_STRATEGY.settlementWindowDuration +
              1,
            provider()
          );
        });

        it('with settle', async () => {
          await assertRevert(
            systems().PerpsMarket.connect(trader1()).settle(2),
            'SettlementWindowExpired'
          );
        });

        it('with settlePythOrder', async () => {
          const validPythPriceData = await systems().MockPyth.createPriceFeedUpdateData(
            DEFAULT_SETTLEMENT_STRATEGY.feedId,
            1000_0000,
            1,
            -4,
            1000_0000,
            1,
            startTime + 6
          );
          updateFee = await systems().MockPyth.getUpdateFee([validPythPriceData]);
          await assertRevert(
            systems()
              .PerpsMarket.connect(keeper())
              .settlePythOrder(validPythPriceData, extraData, { value: updateFee }),
            'SettlementWindowExpired'
          );
        });
      });

      describe('attempts to settle with invalid pyth price data', () => {
        before(restoreBeforeSettle);

        before('fast forward to settlement time', async () => {
          // fast forward to settlement
          await fastForwardTo(
            startTime + DEFAULT_SETTLEMENT_STRATEGY.settlementDelay + 1,
            provider()
          );
        });

        it('reverts with invalid pyth price timestamp (before time)', async () => {
          const validPythPriceData = await systems().MockPyth.createPriceFeedUpdateData(
            DEFAULT_SETTLEMENT_STRATEGY.feedId,
            1000_0000,
            1,
            -4,
            1000_0000,
            1,
            startTime
          );
          updateFee = await systems().MockPyth.getUpdateFee([validPythPriceData]);
          await assertRevert(
            systems()
              .PerpsMarket.connect(keeper())
              .settlePythOrder(validPythPriceData, extraData, { value: updateFee }),
            'PriceFeedNotFoundWithinRange'
          );
        });

        it('reverts with invalid pyth price timestamp (after time)', async () => {
          const validPythPriceData = await systems().MockPyth.createPriceFeedUpdateData(
            DEFAULT_SETTLEMENT_STRATEGY.feedId,
            1000_0000,
            1,
            -4,
            1000_0000,
            1,
            startTime +
              DEFAULT_SETTLEMENT_STRATEGY.settlementDelay +
              DEFAULT_SETTLEMENT_STRATEGY.settlementWindowDuration +
              1
          );
          updateFee = await systems().MockPyth.getUpdateFee([validPythPriceData]);
          await assertRevert(
            systems()
              .PerpsMarket.connect(keeper())
              .settlePythOrder(validPythPriceData, extraData, { value: updateFee }),
            'PriceFeedNotFoundWithinRange'
          );
        });
      });

      describe('settle order', () => {
        before(restoreBeforeSettle);

        before('fast forward to settlement time', async () => {
          // fast forward to settlement
          await fastForwardTo(
            startTime + DEFAULT_SETTLEMENT_STRATEGY.settlementDelay + 1,
            provider()
          );
        });

        it('reverts with offchain info', async () => {
          const functionSig = systems().PerpsMarket.interface.getSighash('settlePythOrder');

          // Coverage tests use hardhat provider, and hardhat provider stringifies array differently
          // hre.network.name === 'hardhat'
          //   ? `[${pythSettlementStrategy.url}]`
          //   : pythSettlementStrategy.url;

          await assertRevert(
            systems().PerpsMarket.connect(keeper()).settle(2),
            `OffchainLookup("${systems().PerpsMarket.address}", "${
              DEFAULT_SETTLEMENT_STRATEGY.url
            }", "${pythCallData}", "${functionSig}", "${extraData}")`
          );
        });

        describe('settle pyth order', () => {
          let pythPriceData: string;
          let settleTx: ethers.ContractTransaction;

          before('prepare data', async () => {
            // Get the latest price
            pythPriceData = await systems().MockPyth.createPriceFeedUpdateData(
              DEFAULT_SETTLEMENT_STRATEGY.feedId,
              1000_0000,
              1,
              -4,
              1000_0000,
              1,
              startTime + 6
            );
            updateFee = await systems().MockPyth.getUpdateFee([pythPriceData]);
          });

          before('settle', async () => {
            settleTx = await systems()
              .PerpsMarket.connect(keeper())
              .settlePythOrder(pythPriceData, extraData, { value: updateFee });
          });

          it('emits event settle event', async () => {
            const accountId = 2;
            const fillPrice = calculateFillPrice(wei(0), wei(100_000), wei(1), wei(1000)).toBN();
            const sizeDelta = bn(1);
            const newPositionSize = bn(1);
            const totalFees = DEFAULT_SETTLEMENT_STRATEGY.settlementReward;
            const settlementReward = DEFAULT_SETTLEMENT_STRATEGY.settlementReward;
            const trackingCode = `"${ethers.constants.HashZero}"`;
            const msgSender = `"${await keeper().getAddress()}"`;
            const params = [
              ethMarketId,
              accountId,
              fillPrice,
              0,
              0,
              sizeDelta,
              newPositionSize,
              totalFees,
              0, // referral fees
              0, // collected fees
              settlementReward,
              trackingCode,
              msgSender,
            ];
            await assertEvent(
              settleTx,
              `OrderSettled(${params.join(', ')})`,
              systems().PerpsMarket
            );
          });

          it('emits market updated event', async () => {
            const price = bn(1000);
            const marketSize = bn(1);
            const marketSkew = bn(1);
            const sizeDelta = bn(1);
            const currentFundingRate = bn(0);
            const currentFundingVelocity = calcCurrentFundingVelocity({
              skew: wei(1),
              skewScale: wei(100_000),
              maxFundingVelocity: wei(10),
            });
            const params = [
              ethMarketId,
              price,
              marketSkew,
              marketSize,
              sizeDelta,
              currentFundingRate,
              currentFundingVelocity.toBN(), // Funding rates should be tested more thoroughly elsewhre
            ];
            await assertEvent(
              settleTx,
              `MarketUpdated(${params.join(', ')})`,
              systems().PerpsMarket
            );
          });

          it('check position is live', async () => {
            const [pnl, funding, size] = await systems().PerpsMarket.getOpenPosition(
              2,
              ethMarketId
            );
            assertBn.equal(pnl, bn(-0.005));
            assertBn.equal(funding, bn(0));
            assertBn.equal(size, bn(1));
          });
        });
      });
    });
  }
});
