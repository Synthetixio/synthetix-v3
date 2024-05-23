import assert from 'assert';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import Wei, { wei } from '@synthetixio/wei';
import { Signer } from 'ethers';
import { shuffle } from 'lodash';
import { bootstrap } from '../../bootstrap';
import {
  bn,
  genBootstrap,
  genOneOf,
  genOrder,
  genOrderFromSizeDelta,
  genSide,
  genTrader,
  toRoundRobinGenerators,
} from '../../generators';
import {
  depositMargin,
  commitAndSettle,
  setMarketConfigurationById,
  withExplicitEvmMine,
  findEventSafe,
  fastForwardBySec,
  getSusdCollateral,
  sleep,
  setMarketConfiguration,
  setBaseFeePerGas,
} from '../../helpers';
import { Market, Trader } from '../../typed';
import { calcLiquidationKeeperFee, calcTransactionCostInUsd } from '../../calculations';

describe('LiquidationModule', () => {
  const bs = bootstrap(genBootstrap());
  const {
    markets,
    collaterals,
    traders,
    keeper,
    keeper2,
    endorsedKeeper,
    systems,
    provider,
    restore,
  } = bs;

  beforeEach(restore);

  afterEach(async () => await setBaseFeePerGas(1, provider()));

  describe('liquidatePosition', () => {
    describe('{partialLiquidation,liquidationCapacity,liqKeeperFee}', () => {
      const configurePartiallyLiquidatedPosition = async (
        desiredFlagger?: Signer,
        desiredLiquidator?: Signer,
        desiredTrader?: Trader,
        desiredMarket?: Market,
        desiredMarginUsdDepositAmount: number = 50_000
      ) => {
        const { BfpMarketProxy } = systems();

        const flaggerKeeper = desiredFlagger ?? keeper();
        const liquidationKeeper = desiredLiquidator ?? keeper();

        const flaggerKeeperAddr = await flaggerKeeper.getAddress();
        const liquidationKeeperAddr = await liquidationKeeper.getAddress();

        // Be quite explicit with what market and market params we are using to ensure a partial liquidation.
        const market = desiredMarket ?? markets()[0];
        await market.aggregator().mockSetCurrentPrice(bn(25_000));
        const orderSide = genSide();

        const { trader, marketId, collateral, collateralDepositAmount } = await depositMargin(
          bs,
          genTrader(bs, { desiredTrader, desiredMarket: market, desiredMarginUsdDepositAmount })
        );
        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredLeverage: 10,
          desiredSide: orderSide,
        });
        await commitAndSettle(bs, marketId, trader, order);

        // Reconfigure market to lower the remainingCapacity such that it's < collateralDepositAmount but > 0.
        //
        // This effectively gives us a liquidation max cap at 1.
        await setMarketConfigurationById(bs, marketId, {
          liquidationLimitScalar: bn(0.01),
          makerFee: bn(0.0001),
          takerFee: bn(0.0001),
          skewScale: bn(500_000),
        });

        const capBefore = await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
        assertBn.gt(capBefore.remainingCapacity, 0);
        assertBn.lt(capBefore.remainingCapacity, collateralDepositAmount);

        // Price moves 10% and results in a healthFactor of < 1.
        const newMarketOraclePrice = wei(order.oraclePrice)
          .mul(orderSide === 1 ? 0.9 : 1.1)
          .toBN();
        await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);
        await withExplicitEvmMine(
          () => BfpMarketProxy.connect(flaggerKeeper).flagPosition(trader.accountId, marketId),
          provider()
        );

        // Attempt the liquidate. This should complete successfully.
        const { tx, receipt } = await withExplicitEvmMine(
          () =>
            BfpMarketProxy.connect(liquidationKeeper).liquidatePosition(trader.accountId, marketId),
          provider()
        );

        const positionLiquidatedEvent = findEventSafe(
          receipt,
          'PositionLiquidated',
          BfpMarketProxy
        );

        const remainingSize = order.sizeDelta.abs().sub(capBefore.remainingCapacity).mul(orderSide);
        const positionLiquidatedEventProperties = [
          trader.accountId,
          marketId,
          order.sizeDelta,
          remainingSize,
          `"${flaggerKeeperAddr}"`,
          `"${liquidationKeeperAddr}"`,
          positionLiquidatedEvent?.args.liqKeeperFee,
          newMarketOraclePrice,
        ].join(', ');
        await assertEvent(
          receipt,
          `PositionLiquidated(${positionLiquidatedEventProperties})`,
          BfpMarketProxy
        );

        const capAfter = await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
        assertBn.isZero(capAfter.remainingCapacity);

        return {
          tx,
          receipt,
          marketId,
          market,
          order,
          orderSide,
          liquidatedSize: capBefore.remainingCapacity,
          remainingSize,
          trader,
          flaggerKeeper,
          liquidationKeeper,
        };
      };

      it('should partially liquidate and exhaust cap if position hits liq window cap', async () => {
        const { BfpMarketProxy } = systems();

        const { marketId } = await configurePartiallyLiquidatedPosition();
        const cap = await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);

        assertBn.isZero(cap.remainingCapacity);
      });

      it('should partially update market skew/size when partially liquidated', async () => {
        const { BfpMarketProxy } = systems();

        const { remainingSize, marketId } = await configurePartiallyLiquidatedPosition();
        const d1 = await BfpMarketProxy.getMarketDigest(marketId);

        assertBn.equal(d1.size, remainingSize.abs());
        assertBn.equal(d1.skew, remainingSize);
      });

      it('should allow an endorsed keeper to fully liquidate a position even if above caps', async () => {
        const { BfpMarketProxy } = systems();

        const { trader, remainingSize, marketId } = await configurePartiallyLiquidatedPosition();

        // Should be fullt exhausted.
        const cap1 = await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
        assertBn.isZero(cap1.remainingCapacity);

        // Endorsed liqudaitor to liquidate remaining capacity.
        const d1 = await BfpMarketProxy.getAccountDigest(trader.accountId, marketId);
        assertBn.equal(d1.position.size, remainingSize);

        await withExplicitEvmMine(
          () =>
            BfpMarketProxy.connect(endorsedKeeper()).liquidatePosition(trader.accountId, marketId),
          provider()
        );

        const d2 = await BfpMarketProxy.getAccountDigest(trader.accountId, marketId);
        assertBn.isZero(d2.position.size);

        const cap2 = await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
        assertBn.isZero(cap2.remainingCapacity);
      });

      it('should allow further liquidations even if exceed caps when pd is below maxPd', async () => {
        const { BfpMarketProxy } = systems();

        const tradersGenerator = toRoundRobinGenerators(shuffle(traders()));
        const trader1 = tradersGenerator.next().value;
        const trader2 = tradersGenerator.next().value;
        const desiredMarginUsdDepositAmount = 50_000;

        const desiredKeeper = keeper();
        const desiredKeeperAddress = await desiredKeeper.getAddress();

        const {
          liquidatedSize,
          marketId,
          market,
          order: order1,
          orderSide: orderSide1,
        } = await configurePartiallyLiquidatedPosition(
          desiredKeeper,
          desiredKeeper,
          trader1,
          undefined,
          desiredMarginUsdDepositAmount
        );

        // Partially liquidated position.
        const cap = await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
        assertBn.isZero(cap.remainingCapacity);

        // Open another position with the same to balance skew.
        await depositMargin(
          bs,
          genTrader(bs, {
            desiredTrader: trader2,
            desiredMarket: market,
            desiredMarginUsdDepositAmount,
          })
        );

        // Inverted side to neutralize skew.
        const desiredOrderSize = liquidatedSize.mul(orderSide1 === 1 ? -1 : 1);
        const order = await genOrderFromSizeDelta(bs, market, desiredOrderSize);
        await commitAndSettle(bs, marketId, trader2, order);

        // Liquidate remaining size.
        const { receipt } = await withExplicitEvmMine(
          () => BfpMarketProxy.connect(keeper()).liquidatePosition(trader1.accountId, marketId),
          provider()
        );

        const positionLiquidatedEvent = findEventSafe(
          receipt,
          'PositionLiquidated',
          BfpMarketProxy
        );

        // Partial liquidation (again) - not high enough cap to fully liquidate but did bypass liquidations.
        //
        // NOTE: We .mul(2) here because the position has been partially liquidated _twice_.
        const expectedSizeBeforeLiquidation = order1.sizeDelta
          .abs()
          .sub(liquidatedSize) // 1x liquidatedSize to account for the first liq.
          .mul(orderSide1);
        const expectedRemainingSize = order1.sizeDelta
          .abs()
          .sub(liquidatedSize.mul(2))
          .mul(orderSide1);
        const positionLiquidatedEventProperties = [
          trader1.accountId,
          marketId,
          expectedSizeBeforeLiquidation,
          expectedRemainingSize, // Remaining size to liquidate (none = dead).
          `"${desiredKeeperAddress}"`,
          `"${desiredKeeperAddress}"`,
          positionLiquidatedEvent?.args.liqKeeperFee,
          order.oraclePrice,
        ].join(', ');

        await assertEvent(
          receipt,
          `PositionLiquidated(${positionLiquidatedEventProperties})`,
          BfpMarketProxy
        );
      });

      it('should progressively liquidate a large position by the window cap size when below maxPd', async () => {
        const { BfpMarketProxy } = systems();

        const trader = traders()[0];
        const otherTradersGenerator = toRoundRobinGenerators(shuffle(traders().slice(1)));

        const market = markets()[0];
        await market.aggregator().mockSetCurrentPrice(bn(10_000));
        const orderSide = genSide();
        const marginUsdDepositAmount = 16_000;

        // Create a significant position and flag for liquidation.
        const { marketId, collateral, collateralDepositAmount } = await depositMargin(
          bs,
          genTrader(bs, {
            desiredTrader: trader,
            desiredMarket: market,
            desiredMarginUsdDepositAmount: marginUsdDepositAmount,
          })
        );
        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredLeverage: 10,
          desiredSide: orderSide,
          desiredKeeperFeeBufferUsd: 0,
        });
        await commitAndSettle(bs, marketId, trader, order);

        // maxLiqCap = (makerFee + takerFee) * skewScale * limitScalar
        //           = (0.0002 + 0.0002) * 1000000 * 0.01
        //           = 4
        const liquidationLimitScalar = bn(0.01);
        const makerFee = bn(0.0002);
        const takerFee = bn(0.0002);
        const skewScale = bn(1_000_000);

        await setMarketConfigurationById(bs, marketId, {
          liquidationLimitScalar,
          makerFee,
          takerFee,
          skewScale,
        });
        const { maxLiquidatableCapacity } =
          await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
        const expectedMaxLiquidatableCapacity = wei(makerFee.add(takerFee))
          .mul(skewScale)
          .mul(liquidationLimitScalar)
          .toBN();
        assertBn.equal(maxLiquidatableCapacity, expectedMaxLiquidatableCapacity);

        // Price moves 10% and results in a healthFactor of < 1.
        const newMarketOraclePrice = wei(order.oraclePrice)
          .mul(orderSide === 1 ? 0.9 : 1.1)
          .toBN();
        await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);
        await withExplicitEvmMine(
          () => BfpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId),
          provider()
        );

        let position = await BfpMarketProxy.getPositionDigest(trader.accountId, marketId);
        assertBn.equal(position.size.abs(), order.sizeDelta.abs());

        const expectedLiquidationIterations = Math.ceil(
          wei(position.size.abs()).div(maxLiquidatableCapacity).toNumber()
        );
        let liquidationIterations = 0;

        while (!position.size.isZero()) {
          // Attempt to liquidate.
          //
          // No caps would have been met on the first iteration.
          await withExplicitEvmMine(
            () => BfpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId),
            provider()
          );

          // Subsequent liquidation attempts should have reached cap.
          if (liquidationIterations > 0) {
            const { remainingCapacity } =
              await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
            assertBn.isZero(remainingCapacity);
          }

          // Resulting position's size should be oldPosition.size - maxLiquidatableCapacity
          const nextPosition = await BfpMarketProxy.getPositionDigest(trader.accountId, marketId);
          const amountLiquidated = Wei.min(
            wei(position.size.abs()),
            wei(maxLiquidatableCapacity)
          ).toBN();
          assertBn.equal(nextPosition.size.abs(), position.size.abs().sub(amountLiquidated));

          // Open an order in the opposite side to bring skew / skewScale < maxPd
          const otherTrader = otherTradersGenerator.next().value;

          const { collateral: oCollateral, collateralDepositAmount: ocollateralDepositAmount } =
            await depositMargin(
              bs,
              genTrader(bs, {
                desiredTrader: otherTrader,
                desiredMarket: market,
                desiredCollateral: getSusdCollateral(collaterals()),
                desiredMarginUsdDepositAmount: marginUsdDepositAmount,
              })
            );
          const order = await genOrder(bs, market, oCollateral, ocollateralDepositAmount, {
            desiredSize: amountLiquidated.mul(orderSide).mul(orderSide), // .mul . mul to ensure we're on the opposite side.
            desiredKeeperFeeBufferUsd: 0,
          });
          await commitAndSettle(bs, marketId, otherTrader, order);

          liquidationIterations += 1;
          position = nextPosition;

          // Give the RPC some time to calm down. If we spam too much, it can error out.
          await sleep(500);
        }

        assert.equal(liquidationIterations, expectedLiquidationIterations);
      });

      it('should not liquidate more than position size', async () => {
        const { BfpMarketProxy } = systems();

        const trader1 = traders()[0];
        const trader2 = traders()[1];

        const market = markets()[0];
        await market.aggregator().mockSetCurrentPrice(bn(10_000));
        const orderSide = genSide();
        const marginUsdDepositAmount = 16_000;

        // Create a significant position and flag for liquidation.
        const { marketId, collateral, collateralDepositAmount } = await depositMargin(
          bs,
          genTrader(bs, {
            desiredTrader: trader1,
            desiredMarket: market,
            desiredMarginUsdDepositAmount: marginUsdDepositAmount,
          })
        );
        const order1 = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredLeverage: 10,
          desiredSide: orderSide,
          desiredKeeperFeeBufferUsd: 0,
        });
        await commitAndSettle(bs, marketId, trader1, order1);

        // maxLiqCap = (makerFee + takerFee) * skewScale * limitScalar
        //           = (0.0002 + 0.0002) * 1000000 * 0.01
        //           = 4
        const liquidationLimitScalar = bn(0.01);
        const makerFee = bn(0.0002);
        const takerFee = bn(0.0002);
        const skewScale = bn(1_000_000);

        await setMarketConfigurationById(bs, marketId, {
          liquidationLimitScalar,
          makerFee,
          takerFee,
          skewScale,
        });
        const { maxLiquidatableCapacity } =
          await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
        const expectedMaxLiquidatableCapacity = wei(makerFee.add(takerFee))
          .mul(skewScale)
          .mul(liquidationLimitScalar)
          .toBN();
        assertBn.equal(maxLiquidatableCapacity, expectedMaxLiquidatableCapacity);

        // Price moves 10% and results in a healthFactor of < 1.
        const newMarketOraclePrice = wei(order1.oraclePrice)
          .mul(orderSide === 1 ? 0.9 : 1.1)
          .toBN();
        await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);
        await withExplicitEvmMine(
          () => BfpMarketProxy.connect(keeper()).flagPosition(trader1.accountId, marketId),
          provider()
        );

        const position = await BfpMarketProxy.getPositionDigest(trader1.accountId, marketId);
        assertBn.equal(position.size.abs(), order1.sizeDelta.abs());

        // Use up the entire liqCap.
        await withExplicitEvmMine(
          () => BfpMarketProxy.connect(keeper()).liquidatePosition(trader1.accountId, marketId),
          provider()
        );

        // Confirm cap is zero.
        const { remainingCapacity } =
          await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
        assertBn.isZero(remainingCapacity);

        // Resulting position's size should be oldPosition.size - maxLiquidatableCapacity
        let nextPosition = await BfpMarketProxy.getPositionDigest(trader1.accountId, marketId);
        const amountLiquidated = Wei.min(
          wei(position.size.abs()),
          wei(maxLiquidatableCapacity)
        ).toBN();

        assertBn.equal(nextPosition.size.abs(), position.size.abs().sub(amountLiquidated));

        // Open an order in the opposite side to bring skew / skewScale < maxPd
        const { collateral: oCollateral, collateralDepositAmount: ocollateralDepositAmount } =
          await depositMargin(
            bs,
            genTrader(bs, {
              desiredTrader: trader2,
              desiredMarket: market,
              desiredCollateral: getSusdCollateral(collaterals()),
              desiredMarginUsdDepositAmount: wei(amountLiquidated)
                .mul(newMarketOraclePrice)
                .toNumber(),
            })
          );
        const order = await genOrder(bs, market, oCollateral, ocollateralDepositAmount, {
          desiredSize: amountLiquidated.mul(orderSide).mul(orderSide),
          desiredKeeperFeeBufferUsd: 0,
        });
        await commitAndSettle(bs, marketId, trader2, order);

        // Attempt to liquidate again, bypassing caps. This should liquidate at most maxCap.
        await withExplicitEvmMine(
          () => BfpMarketProxy.connect(keeper()).liquidatePosition(trader1.accountId, marketId),
          provider()
        );

        // Confirm the position is _not_ completely liquidated `.mul(2)` because we've made 2 explicit liquidations.
        const totalAmountLiquidated = Wei.min(
          wei(position.size.abs()),
          wei(maxLiquidatableCapacity).mul(2)
        ).toBN();
        nextPosition = await BfpMarketProxy.getPositionDigest(trader1.accountId, marketId);
        assertBn.gt(nextPosition.size.abs(), bn(0));
        assertBn.equal(nextPosition.size.abs(), position.size.abs().sub(totalAmountLiquidated));
      });

      it('should reset caps after window timeframe has elapsed', async () => {
        const { BfpMarketProxy } = systems();

        const { marketId } = await configurePartiallyLiquidatedPosition();

        // NOTE: We make an assumption about the configured liquidationWindowDuration.
        //
        // We know that this value is defined as 30s. If this changes then this test will most likely
        // break and this comment will be served as a notice.
        const { liquidationWindowDuration } =
          await BfpMarketProxy.getMarketConfigurationById(marketId);

        // Caps before moving time forward.
        const cap1 = await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
        assertBn.isZero(cap1.remainingCapacity);

        await fastForwardBySec(provider(), 15); // Half way into cap.

        const cap2 = await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
        assertBn.isZero(cap2.remainingCapacity);

        await fastForwardBySec(provider(), 14); // One second before end of cap.

        const cap3 = await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
        assertBn.isZero(cap3.remainingCapacity);

        await fastForwardBySec(provider(), 1); // Exact 30s.

        const cap4 = await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
        assertBn.equal(cap4.remainingCapacity, cap4.maxLiquidatableCapacity);

        await fastForwardBySec(provider(), 5); // 5s into new window.

        const cap5 = await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
        assertBn.equal(cap5.remainingCapacity, cap5.maxLiquidatableCapacity);

        await fastForwardBySec(provider(), liquidationWindowDuration.toNumber()); // > window over.

        const cap6 = await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
        assertBn.equal(cap6.remainingCapacity, cap6.maxLiquidatableCapacity);
      });

      it('should pay out liquidation fee to liquidator in chunks added up to total', async () => {
        const { BfpMarketProxy } = systems();

        const marketOraclePrice1 = bn(10_000);
        const market = markets()[0];
        const collateral = getSusdCollateral(collaterals());
        await market.aggregator().mockSetCurrentPrice(marketOraclePrice1);

        // Open a decently large position that would result in a partial liquidation.
        const { trader, marketId, collateralDepositAmount } = await depositMargin(
          bs,
          genTrader(bs, {
            desiredMarket: market,
            desiredMarginUsdDepositAmount: 100_000,
            desiredCollateral: collateral,
          })
        );
        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredLeverage: 10,
          desiredSide: 1,
          desiredKeeperFeeBufferUsd: 0,
        });
        await commitAndSettle(bs, marketId, trader, order);

        // Reconfigure market to lower the remainingCapacity such that it's < collateralDepositAmount but > 0.
        //
        // This effectively gives us a liquidation max cap at 1.

        const globalConfig = await setMarketConfiguration(bs, {
          maxKeeperFeeUsd: bn(100_000), // really large max as we're testing chunking not max
        });

        const capBefore = await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);

        assertBn.gt(capBefore.remainingCapacity, 0);
        assertBn.lt(capBefore.remainingCapacity, collateralDepositAmount);

        // Price moves 10% and results in a healthFactor of < 1.
        //
        // 10k -> 9k
        const marketOraclePrice2 = wei(marketOraclePrice1).mul(0.9).toBN();
        await market.aggregator().mockSetCurrentPrice(marketOraclePrice2);

        const baseFeePerGas = await setBaseFeePerGas(0, provider());

        const { liqKeeperFee } = await BfpMarketProxy.getLiquidationFees(
          trader.accountId,
          marketId
        );

        const { answer: ethPrice } = await bs.ethOracleNode().agg.latestRoundData();
        const expectedLiqFee = calcLiquidationKeeperFee(
          ethPrice,
          baseFeePerGas,
          wei(order.sizeDelta).abs(),
          wei(capBefore.maxLiquidatableCapacity),
          globalConfig
        );
        assertBn.equal(expectedLiqFee.toBN(), liqKeeperFee);

        // Dead.
        await withExplicitEvmMine(
          () =>
            BfpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId, {
              maxPriorityFeePerGas: 0,
            }),
          provider()
        );

        let accLiqRewards = bn(0);
        let remainingSize = bn(-1);

        // Perform enough partial liquidations until fully liquidated.
        while (!remainingSize.isZero()) {
          const { receipt } = await withExplicitEvmMine(
            () =>
              BfpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId, {
                maxPriorityFeePerGas: 0,
              }),
            provider()
          );
          const { liqKeeperFee, remainingSize: _remSize } = findEventSafe(
            receipt,
            'PositionLiquidated',
            BfpMarketProxy
          ).args;

          accLiqRewards = accLiqRewards.add(liqKeeperFee);
          remainingSize = _remSize;
        }
        // `sum(liqReward)` should equal to liqReward from the prior step.
        assertBn.equal(accLiqRewards, expectedLiqFee.toBN());
      });

      it('should cap liqKeeperFee and flagKeeperReward to the maxKeeperFee', async () => {
        const { BfpMarketProxy } = systems();

        const orderSide = genSide();
        // keeperProfitMarginUsd set to 10, maxKeeperFeeUsd set to 1 means no matter the size of the pos, maxKeeperFeeUsd will be used as that's the determining factor
        await setMarketConfiguration(bs, {
          maxKeeperFeeUsd: bn(1),
          keeperProfitMarginUsd: bn(10),
        });

        const { trader, market, marketId, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));

        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredLeverage: 10,
          desiredSide: orderSide,
        });

        await commitAndSettle(bs, marketId, trader, order);

        // Price falls/rises between 10% should results in a healthFactor of < 1.
        // Whether it goes up or down depends on the side of the order.
        const newMarketOraclePrice = wei(order.oraclePrice)
          .mul(orderSide === 1 ? 0.9 : 1.1)
          .toBN();
        await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

        const { receipt: flagReceipt } = await withExplicitEvmMine(
          () => BfpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId),
          provider()
        );
        const { receipt: liqReceipt } = await withExplicitEvmMine(
          () => BfpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId),
          provider()
        );

        const { flagKeeperReward } = findEventSafe(
          flagReceipt,
          'PositionFlaggedLiquidation',
          BfpMarketProxy
        ).args;
        const { liqKeeperFee } = findEventSafe(
          liqReceipt,
          'PositionLiquidated',
          BfpMarketProxy
        ).args;

        assertBn.equal(flagKeeperReward, bn(1));
        assertBn.equal(liqKeeperFee, bn(1));
      });

      it('should use keeperProfitMarginPercent when bigger than keeperProfitMarginUsd', async () => {
        const { BfpMarketProxy } = systems();

        const orderSide = genSide();

        const { trader, market, marketId, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs, { desiredMarginUsdDepositAmount: 1000 }));

        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredLeverage: 8, // 8k pos
          desiredSide: orderSide,
        });

        await commitAndSettle(bs, marketId, trader, order);

        // Price falls/rises between 10% should results in a healthFactor of < 1.
        // Whether it goes up or down depends on the side of the order.
        const newMarketOraclePrice = wei(order.oraclePrice)
          .mul(orderSide === 1 ? 0.9 : 1.1)
          .toBN();
        await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

        const { liquidationRewardPercent: flagRewardPercent } = await setMarketConfigurationById(
          bs,
          marketId,
          { liquidationRewardPercent: bn(0.0001) } // really small so we dont hit maxKeeperFeeUsd
        );
        const { keeperProfitMarginPercent, keeperLiquidationGasUnits, keeperFlagGasUnits } =
          await setMarketConfiguration(bs, {
            maxKeeperFeeUsd: bn(1234567), // large max fee to make sure it's not used
            keeperProfitMarginUsd: bn(0), // ensure keeperProfitMarginPercent would be used instead
            keeperLiquidationGasUnits: 500_000,
            keeperFlagGasUnits: 500_000,
          });

        // Set baseFeePerGas to 1gwei
        const baseFeePerGas = await setBaseFeePerGas(1, provider());

        const { receipt: flagReceipt } = await withExplicitEvmMine(
          () => BfpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId),
          provider()
        );
        const { answer: ethPrice } = await bs.ethOracleNode().agg.latestRoundData();

        // Set baseFeePerGas to 1 gwei again
        await setBaseFeePerGas(1, provider());
        const { receipt: liqReceipt } = await withExplicitEvmMine(
          () =>
            BfpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId, {
              maxPriorityFeePerGas: 0, // no priority fee to keep things simple
            }),
          provider()
        );

        const { liqKeeperFee } = findEventSafe(
          liqReceipt,
          'PositionLiquidated',
          BfpMarketProxy
        ).args;
        const { flagKeeperReward, flaggedPrice } = findEventSafe(
          flagReceipt,
          'PositionFlaggedLiquidation',
          BfpMarketProxy
        ).args;
        const sizeAbsUsd = wei(order.sizeDelta).abs().mul(flaggedPrice);
        const expectedCostFlag = calcTransactionCostInUsd(
          baseFeePerGas,
          keeperFlagGasUnits,
          ethPrice
        );
        const expectedFlagReward = wei(expectedCostFlag)
          .mul(wei(1).add(keeperProfitMarginPercent))
          .add(sizeAbsUsd.mul(flagRewardPercent));

        assertBn.equal(flagKeeperReward, expectedFlagReward.toBN());

        const expectedCostLiq = calcTransactionCostInUsd(
          baseFeePerGas,
          keeperLiquidationGasUnits,
          ethPrice
        );
        const expectedKeeperFee = wei(expectedCostLiq).mul(wei(1).add(keeperProfitMarginPercent));

        assertBn.equal(liqKeeperFee, wei(expectedKeeperFee).toBN());
      });

      it('should use keeperProfitMarginUsd when keeperProfitMarginPercent is small', async () => {
        const { BfpMarketProxy } = systems();

        const orderSide = genSide();

        const { trader, market, marketId, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs, { desiredMarginUsdDepositAmount: 1000 }));

        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredLeverage: 8, // 8k pos
          desiredSide: orderSide,
        });

        await commitAndSettle(bs, marketId, trader, order);
        // Price falls/rises between 10% should results in a healthFactor of < 1.
        // Whether it goes up or down depends on the side of the order.
        const newMarketOraclePrice = wei(order.oraclePrice)
          .mul(orderSide === 1 ? 0.9 : 1.1)
          .toBN();
        await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);
        const { liquidationRewardPercent: flagRewardPercent } = await setMarketConfigurationById(
          bs,
          marketId,
          { liquidationRewardPercent: bn(0.0001) } // really small so we dont hit maxKeeperFeeUsd
        );
        const { keeperProfitMarginUsd, keeperLiquidationGasUnits, keeperFlagGasUnits } =
          await setMarketConfiguration(bs, {
            maxKeeperFeeUsd: bn(1234567), // large max fee to make sure it's not used
            keeperProfitMarginPercent: bn(0.00001), // small margin percent to ensure we use keeperProfitMarginUsd
            keeperLiquidationGasUnits: 500_000,
            keeperFlagGasUnits: 500_000,
          });

        // Set baseFeePerGas to 1gwei
        await setBaseFeePerGas(0, provider());
        const { receipt: flagReceipt } = await withExplicitEvmMine(
          () => BfpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId),
          provider()
        );

        const { answer: ethPrice } = await bs.ethOracleNode().agg.latestRoundData();

        // Set baseFeePerGas to 1gwei
        const baseFeePerGas = await setBaseFeePerGas(0, provider());

        const { receipt: liqReceipt } = await withExplicitEvmMine(
          () =>
            BfpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId, {
              maxPriorityFeePerGas: 0, // no priority fee to keep things simple
            }),
          provider()
        );

        const { flagKeeperReward, flaggedPrice } = findEventSafe(
          flagReceipt,
          'PositionFlaggedLiquidation',
          BfpMarketProxy
        ).args;
        const { liqKeeperFee } = findEventSafe(
          liqReceipt,
          'PositionLiquidated',
          BfpMarketProxy
        ).args;
        const sizeAbsUsd = wei(order.sizeDelta).abs().mul(flaggedPrice);
        const expectedCostFlag = calcTransactionCostInUsd(
          baseFeePerGas,
          keeperFlagGasUnits,
          ethPrice
        );
        const expectedFlagReward = wei(expectedCostFlag)
          .add(wei(keeperProfitMarginUsd))
          .add(sizeAbsUsd.mul(flagRewardPercent));

        assertBn.equal(flagKeeperReward, expectedFlagReward.toBN());

        const expectedCostLiq = calcTransactionCostInUsd(
          baseFeePerGas,
          keeperLiquidationGasUnits,
          ethPrice
        );
        const expectedKeeperFee = wei(expectedCostLiq).add(wei(keeperProfitMarginUsd));

        assertBn.equal(liqKeeperFee, wei(expectedKeeperFee).toBN());
      });

      it('should result in a higher liqReward if market price moves in favour of position');

      it('should result in a lower liqReward if market moves unfavourably of position');

      it('should use up cap (partial) before exceeding if pd < maxPd');

      it('should track and include endorsed keeper activity (cap + time) on liquidations', async () => {
        const { BfpMarketProxy } = systems();

        // Use the endorsed keeper to liquidate.
        const keeper = endorsedKeeper();
        const market = markets()[0];
        const marketId = market.marketId();

        const d1 = await BfpMarketProxy.getMarketDigest(marketId);

        await configurePartiallyLiquidatedPosition(keeper, keeper, undefined, market);

        const d2 = await BfpMarketProxy.getMarketDigest(marketId);

        // Last liquidation time is the current block (i.e. the time the position was liquidated).
        assertBn.isZero(d1.lastLiquidationTime);
        assertBn.equal((await provider().getBlock('latest')).timestamp, d2.lastLiquidationTime);

        // Ensure the capacity is also updated to reflect the liquidation.
        assertBn.gt(d1.remainingLiquidatableSizeCapacity, d2.remainingLiquidatableSizeCapacity);
      });

      it('should not remove flagger on partial liquidation', async () => {
        const { BfpMarketProxy } = systems();

        const { trader, marketId } = await configurePartiallyLiquidatedPosition();

        // Partially liquidated and should still remain flagged. A re-flat should not be allowed.
        await assertRevert(
          BfpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId),
          `PositionFlagged()`,
          BfpMarketProxy
        );
      });

      it('should accumulate liq utilization without exceeding cap', async () => {
        const { BfpMarketProxy } = systems();

        const flaggerKeeper = keeper();
        const liquidationKeeper = keeper2();

        // Ensure we use the same side and market for all traders.
        const orderSide = genSide();
        const market = genOneOf(markets());
        const marketId = market.marketId();

        // Set a fairly large liquidation limit scalar to prevent partial liquidations. Also give a large enough
        // window to ensure liquidations all occur within one window.
        await setMarketConfigurationById(bs, marketId, {
          liquidationLimitScalar: bn(10),
          liquidationWindowDuration: 60,
        });

        const orders: Awaited<ReturnType<typeof genOrder>>[] = [];

        // For two traders, open a position (both on the same side) and liquidate everything. The
        // sum of all sizeDelta should be the utilization and remaining should be max - utilization.
        const tradersToUse = traders().slice(0, 2);

        for (const trader of tradersToUse) {
          const marginUsdDepositAmount = genOneOf([2000, 5000, 10_000]);
          const collateral = genOneOf(collaterals());

          const { collateralDepositAmount: collateralDepositAmount1 } = await depositMargin(
            bs,
            genTrader(bs, {
              desiredTrader: trader,
              desiredCollateral: collateral,
              desiredMarket: market,
              desiredMarginUsdDepositAmount: marginUsdDepositAmount,
            })
          );
          const order = await genOrder(bs, market, collateral, collateralDepositAmount1, {
            desiredLeverage: 10,
            desiredSide: orderSide,
          });
          await commitAndSettle(bs, marketId, trader, order);

          orders.push(order);
        }

        const sizeToLiquidate = orders.reduce(
          (acc, order) => acc.add(order.sizeDelta.abs()),
          bn(0)
        );

        // Verify that liquidating both will not incur any caps.
        const capBefore = await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
        assertBn.gt(capBefore.remainingCapacity, sizeToLiquidate);

        // Place both traders into liquidation.
        const oraclePrice = await BfpMarketProxy.getOraclePrice(marketId);
        const newMarketOraclePrice = wei(oraclePrice)
          .mul(orderSide === 1 ? 0.9 : 1.1)
          .toBN();
        await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

        // Flag and liquidate it all.
        for (const trader of tradersToUse) {
          await withExplicitEvmMine(
            () => BfpMarketProxy.connect(flaggerKeeper).flagPosition(trader.accountId, marketId),
            provider()
          );
          await withExplicitEvmMine(
            () =>
              BfpMarketProxy.connect(liquidationKeeper).liquidatePosition(
                trader.accountId,
                marketId
              ),
            provider()
          );
        }

        // Ensure both liquidations occurred on the same block.
        assertBn.isZero((await BfpMarketProxy.getMarketDigest(marketId)).size);

        // Ensure both were fully liquidated.
        const capAfter = await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);

        // Ensure caps have not changed between liquidations.
        assertBn.equal(capBefore.maxLiquidatableCapacity, capAfter.maxLiquidatableCapacity);
        assertBn.equal(
          capAfter.remainingCapacity,
          capAfter.maxLiquidatableCapacity.sub(sizeToLiquidate)
        );

        // Verify internal accounting tracks correct liquidation time and amount.
        const { remainingLiquidatableSizeCapacity } =
          await BfpMarketProxy.getMarketDigest(marketId);
        assertBn.equal(
          capAfter.maxLiquidatableCapacity.sub(remainingLiquidatableSizeCapacity),
          sizeToLiquidate
        );
      });

      it('should accumulate an into existing liquidation chunk if two tx in the same block', async () => {
        const { BfpMarketProxy } = systems();

        const flaggerKeeper = keeper();
        const liquidationKeeper = keeper2();

        const tradersGenerator = toRoundRobinGenerators(shuffle(traders()));
        const trader1 = tradersGenerator.next().value;
        const trader2 = tradersGenerator.next().value;

        const orderSide = genSide();
        const marginUsdDepositAmount = 15_000;
        const collateral = collaterals()[0]; // sUSD
        const market = markets()[0];
        const marketId = market.marketId();

        // Set a fairly large liquidation limit scalar to prevent partial liquidations.
        await setMarketConfigurationById(bs, marketId, { liquidationLimitScalar: bn(10) });

        // Trader 1.
        const { collateralDepositAmount: collateralDepositAmount1 } = await depositMargin(
          bs,
          genTrader(bs, {
            desiredTrader: trader1,
            desiredCollateral: collateral,
            desiredMarket: market,
            desiredMarginUsdDepositAmount: marginUsdDepositAmount,
          })
        );
        const order1 = await genOrder(bs, market, collateral, collateralDepositAmount1, {
          desiredLeverage: 10,
          desiredSide: orderSide,
        });
        await commitAndSettle(bs, marketId, trader1, order1);

        // Trader 2.
        const { collateralDepositAmount: collateralDepositAmount2 } = await depositMargin(
          bs,
          genTrader(bs, {
            desiredTrader: trader2,
            desiredCollateral: collateral,
            desiredMarket: market,
            desiredMarginUsdDepositAmount: marginUsdDepositAmount,
          })
        );
        const order2 = await genOrder(bs, market, collateral, collateralDepositAmount2, {
          desiredLeverage: 10,
          desiredSide: orderSide,
        });
        await commitAndSettle(bs, marketId, trader2, order2);

        const sizeToLiquidate = order1.sizeDelta.abs().add(order2.sizeDelta.abs());

        // Verify that liquidating both will not incur any caps.
        const capBefore = await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
        assertBn.gt(capBefore.remainingCapacity, sizeToLiquidate);

        // Place both traders into liquidation.
        const oraclePrice = order1.oraclePrice;
        const newMarketOraclePrice = wei(oraclePrice)
          .mul(orderSide === 1 ? 0.9 : 1.1)
          .toBN();
        await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

        // Flag both users for liquidation.
        await withExplicitEvmMine(
          () => BfpMarketProxy.connect(flaggerKeeper).flagPosition(trader1.accountId, marketId),
          provider()
        );
        await withExplicitEvmMine(
          () => BfpMarketProxy.connect(flaggerKeeper).flagPosition(trader2.accountId, marketId),
          provider()
        );

        // Attempt to liquidate both in a single block.
        await provider().send('evm_setAutomine', [false]);

        const tx1 = await BfpMarketProxy.connect(liquidationKeeper).liquidatePosition(
          trader1.accountId,
          marketId
        );
        const tx2 = await BfpMarketProxy.connect(liquidationKeeper).liquidatePosition(
          trader2.accountId,
          marketId
        );

        await provider().send('evm_mine', []);
        await provider().send('evm_setAutomine', [true]);

        const receipt1 = await tx1.wait();
        const receipt2 = await tx2.wait();

        // Ensure both liquidations occurred on the same block.
        assert.equal(receipt1.blockNumber, receipt2.blockNumber);
        assert.equal(tx1.timestamp, tx2.timestamp);
        assertBn.isZero((await BfpMarketProxy.getMarketDigest(marketId)).size);

        // Ensure both were fully liquidated.
        const capAfter = await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);

        // Ensure caps have not changed between liquidations.
        assertBn.equal(capBefore.maxLiquidatableCapacity, capAfter.maxLiquidatableCapacity);
        assertBn.equal(
          capAfter.remainingCapacity,
          capAfter.maxLiquidatableCapacity.sub(sizeToLiquidate)
        );

        // Verify internal accounting tracks correct liquidation time and amount.
        const block = await provider().getBlock(receipt1.blockNumber);
        const { lastLiquidationTime, remainingLiquidatableSizeCapacity } =
          await BfpMarketProxy.getMarketDigest(marketId);
        assertBn.equal(lastLiquidationTime, block.timestamp);
        assertBn.equal(
          capAfter.maxLiquidatableCapacity.sub(remainingLiquidatableSizeCapacity),
          sizeToLiquidate
        );
      });

      it('should revert when liq cap has been met and not endorsed', async () => {
        const { BfpMarketProxy } = systems();

        const desiredKeeper = keeper(); // NOT endorsed.
        const { trader, marketId } = await configurePartiallyLiquidatedPosition(
          desiredKeeper,
          desiredKeeper
        );

        // Confirm we have exhausted caps.
        const { remainingCapacity } =
          await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
        assertBn.isZero(remainingCapacity);

        // Do not allow bypass unless market is _perfectly_ balanced. Adding this here to prevent maxPd bypass.
        await setMarketConfigurationById(bs, marketId, { liquidationMaxPd: bn(0) });

        // Attempt to liquidate again.
        await assertRevert(
          BfpMarketProxy.connect(desiredKeeper).liquidatePosition(trader.accountId, marketId),
          `LiquidationZeroCapacity()`,
          BfpMarketProxy
        );
      });

      // TODO: A concrete test with many whales all trading but one has over extended, partially liqudated.
      it('should revert when liq cap has been met and not endorsed (concrete)');

      it('should revert when pd is below maxPd but liquidation happens in the same block');
    });
  });
});
