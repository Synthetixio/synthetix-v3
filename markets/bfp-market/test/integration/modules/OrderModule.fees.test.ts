import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { wei } from '@synthetixio/wei';
import { BigNumber, ethers } from 'ethers';
import forEach from 'mocha-each';
import { bootstrap } from '../../bootstrap';
import { calcOrderFees } from '../../calculations';
import { BfpMarketProxy } from '../../generated/typechain';
import { bn, genBootstrap, genNumber, genOrder, genTrader } from '../../generators';
import {
  commitAndSettle,
  depositMargin,
  findEventSafe,
  setBaseFeePerGas,
  setMarketConfiguration,
  setMarketConfigurationById,
} from '../../helpers';

describe('OrderModule fees', () => {
  const bs = bootstrap(genBootstrap());
  const { systems, restore, provider, collateralsWithoutSusd, markets, traders } = bs;

  beforeEach(restore);

  describe('getOrderFees', () => {
    describe('orderFee', () => {
      enum LiquidtyLeader {
        MAKER = 'MAKER',
        TAKER = 'TAKER',
        BOTH = 'BOTH',
      }

      forEach([
        [LiquidtyLeader.MAKER, 'reducing'],
        [LiquidtyLeader.TAKER, 'expanding'],
        [LiquidtyLeader.BOTH, 'reducing then expanding'],
      ]).it('should charge %s fees when %s skew', async (leader: LiquidtyLeader) => {
        const { BfpMarketProxy } = systems();

        const marginUsdDepositAmount = genNumber(5000, 10_000);
        const leverage = 1;

        // TRADER 1:

        // Deposit margin to trader1, create order, commit and settle the order.
        const gTrader = await depositMargin(
          bs,
          genTrader(bs, { desiredMarginUsdDepositAmount: marginUsdDepositAmount })
        );
        const { marketId, market, collateral } = gTrader;
        const order1 = await genOrder(bs, market, collateral, gTrader.collateralDepositAmount, {
          desiredLeverage: leverage,
        });
        await commitAndSettle(bs, marketId, gTrader.trader, order1);

        // TRADER 2:

        const getDesiredMarginUsdDepositAmount = () => {
          switch (leader) {
            // Ensure the margin for the 2nd trade is LESS than the first order to ensure this is a _pure_
            // maker or taker.
            case LiquidtyLeader.MAKER:
            case LiquidtyLeader.TAKER:
              return marginUsdDepositAmount * 0.9;
            // Give the 2nd order _more_ margin so it's able to reduce the skew and then expand other side.
            case LiquidtyLeader.BOTH:
              return marginUsdDepositAmount * 1.5;
          }
        };

        // Deposit an appropriate amount of margin relative to the leader type we're testing against.
        const gTrader2 = await depositMargin(
          bs,
          genTrader(bs, {
            desiredMarket: market,
            desiredCollateral: collateral,
            desiredMarginUsdDepositAmount: getDesiredMarginUsdDepositAmount(),
          })
        );

        const getDesiredSize = () => {
          switch (leader) {
            // Maker means we're reducing skew so we wanted to invert the first order. `BOTH` is also the same
            // side as maker because we're reducing skew to zero then expanding into the other direction.
            case LiquidtyLeader.MAKER:
            case LiquidtyLeader.BOTH:
              return order1.sizeDelta.gt(0) ? -1 : 1;
            // Taker means we're expanding skew so we want to keep riding up the same side of the first order.
            case LiquidtyLeader.TAKER:
              return order1.sizeDelta.gt(0) ? 1 : -1;
          }
        };

        // Create an order, ensuring the size is relative to the leader we're testing.
        const order2 = await genOrder(bs, market, collateral, gTrader2.collateralDepositAmount, {
          desiredLeverage: leverage,
          desiredSide: getDesiredSize(),
        });

        // Retrieve fees associated with this new order.
        const { orderFee } = await BfpMarketProxy.getOrderFees(marketId, order2.sizeDelta, bn(0));
        const { orderFee: expectedOrderFee } = await calcOrderFees(
          bs,
          marketId,
          order2.sizeDelta,
          order2.keeperFeeBufferUsd
        );

        assertBn.equal(orderFee, expectedOrderFee);
      });

      it('should charge the appropriate maker/taker fee (concrete)', async () => {
        const { BfpMarketProxy } = systems();

        // Use explicit values to test a concrete example.
        const trader = traders()[0];
        const collateral = collateralsWithoutSusd()[0];
        const market = markets()[0];
        const marginUsdDepositAmount = bn(1000);
        const leverage = 1;
        const keeperFeeBufferUsd = 0;
        const collateralDepositAmount = bn(10);
        const collateralPrice = bn(100);
        const marketOraclePrice = bn(1);
        const makerFee = bn(0.01);
        const takerFee = bn(0.02);

        // Update state to reflect explicit values.
        await collateral.setPrice(collateralPrice);
        await market.aggregator().mockSetCurrentPrice(marketOraclePrice);
        const marketId = market.marketId();
        await setMarketConfigurationById(bs, marketId, { makerFee, takerFee });

        await depositMargin(bs, {
          trader,
          traderAddress: await trader.signer.getAddress(),
          market,
          marketId,
          collateral,
          collateralDepositAmount,
          marginUsdDepositAmount,
          collateralPrice,
        });

        // sizeDelta = 10 * 100 / 1 / 1 = 1000
        const order1 = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredLeverage: leverage,
          desiredSide: 1, // 1 = long, -1 = short
          desiredKeeperFeeBufferUsd: keeperFeeBufferUsd,
        });
        const { orderFee: orderFee1 } = await BfpMarketProxy.getOrderFees(
          marketId,
          order1.sizeDelta,
          BigNumber.from(keeperFeeBufferUsd)
        );
        await commitAndSettle(bs, marketId, trader, order1);

        // There are no other positions in market, this should be charging takerFees.
        // sizeDelta * fillPrice * takerFee
        assertBn.equal(wei(order1.sizeDelta).mul(order1.fillPrice).mul(takerFee).toBN(), orderFee1);

        // Using twice as much margin, create an order.
        //
        // 10 * 2 = 20
        //
        // Then use that to infer marginUsd and then back to sizeDelta.
        //
        // 20 * 100 / 1 / 1 = 2000
        const order2 = await genOrder(
          bs,
          market,
          collateral,
          collateralDepositAmount.mul(BigNumber.from(2)),
          {
            desiredLeverage: leverage,
            desiredSide: -1, // 1 = long, -1 = short
            desiredKeeperFeeBufferUsd: keeperFeeBufferUsd,
          }
        );
        const { orderFee: orderFee2 } = await BfpMarketProxy.getOrderFees(
          marketId,
          order2.sizeDelta,
          BigNumber.from(keeperFeeBufferUsd)
        );

        // We know that half of the new order shrinks skew back to 0 (hence makerFee) and the other half increases.
        const makerFeeUsd = wei(order1.sizeDelta.abs()).mul(order2.fillPrice).mul(makerFee);
        const takerFeeUsd = wei(order1.sizeDelta.abs()).mul(order2.fillPrice).mul(takerFee);

        assertBn.equal(orderFee2, makerFeeUsd.add(takerFeeUsd).toBN());
      });

      it('should revert when marketId does not exist', async () => {
        const { BfpMarketProxy } = systems();

        const invalidMarketId = 42069;
        await assertRevert(
          BfpMarketProxy.getOrderFees(invalidMarketId, bn(0), bn(0)),
          `MarketNotFound("${invalidMarketId}")`,
          BfpMarketProxy
        );
      });
    });

    describe('keeperFee', () => {
      const getKeeperFee = (
        BfpMarketProxy: BfpMarketProxy,
        receipt: ethers.ContractReceipt
      ): BigNumber => findEventSafe(receipt, 'OrderSettled', BfpMarketProxy)?.args.keeperFee;

      it('should calculate keeper fees proportional to block.baseFee and profit margin', async () => {
        const { BfpMarketProxy } = systems();

        const { trader, marketId, market, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));
        const order = await genOrder(bs, market, collateral, collateralDepositAmount);
        const { orderFee } = await BfpMarketProxy.getOrderFees(
          marketId,
          order.sizeDelta,
          order.keeperFeeBufferUsd
        );
        const { calcKeeperOrderSettlementFee } = await calcOrderFees(
          bs,
          marketId,
          order.sizeDelta,
          order.keeperFeeBufferUsd
        );
        const { tx, receipt, lastBaseFeePerGas } = await commitAndSettle(
          bs,
          marketId,
          trader,
          order
        );

        const keeperFee = getKeeperFee(BfpMarketProxy, receipt);
        const expectedKeeperFee = calcKeeperOrderSettlementFee(lastBaseFeePerGas);
        assertBn.equal(expectedKeeperFee, keeperFee);
        const block = await provider().getBlock(receipt.blockNumber);
        const timestamp = block.timestamp;

        await assertEvent(
          tx,
          `OrderSettled(${trader.accountId}, ${marketId}, ${timestamp}, ${order.sizeDelta}, ${orderFee}, ${expectedKeeperFee}, 0, 0, 0, ${order.fillPrice}, ${orderFee.add(expectedKeeperFee)})`,
          BfpMarketProxy
        );
      });

      it('should cap the keeperFee by its max usd when exceeds ceiling', async () => {
        const { BfpMarketProxy } = systems();

        // Cap the max keeperFee to $50 USD
        const maxKeeperFeeUsd = bn(50);
        await setMarketConfiguration(bs, { maxKeeperFeeUsd, minKeeperFeeUsd: bn(10) });

        const { trader, marketId, market, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));
        const order = await genOrder(bs, market, collateral, collateralDepositAmount);
        const { calcKeeperOrderSettlementFee } = await calcOrderFees(
          bs,
          marketId,
          order.sizeDelta,
          order.keeperFeeBufferUsd
        );

        // Set a high base fee causing us to hit the maxKeeperFeeUsd
        await setBaseFeePerGas(100, provider());
        const { receipt, lastBaseFeePerGas } = await commitAndSettle(bs, marketId, trader, order);

        const keeperFee = getKeeperFee(BfpMarketProxy, receipt);
        const expectedKeeperFee = calcKeeperOrderSettlementFee(lastBaseFeePerGas);

        assertBn.equal(keeperFee, expectedKeeperFee);
        assertBn.equal(expectedKeeperFee, maxKeeperFeeUsd);
        await setBaseFeePerGas(1, provider());
      });

      it('should cap the keeperFee by its min usd when below floor', async () => {
        const { BfpMarketProxy } = systems();

        // Lower the min requirements to reduce fees fairly significantly.
        const minKeeperFeeUsd = bn(60);
        await setMarketConfiguration(bs, {
          keeperSettlementGasUnits: 100_000,
          maxKeeperFeeUsd: bn(100),
          minKeeperFeeUsd,
          keeperProfitMarginPercent: bn(0),
        });

        const { trader, marketId, market, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));
        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredKeeperFeeBufferUsd: 0,
        });
        const { calcKeeperOrderSettlementFee } = await calcOrderFees(
          bs,
          marketId,
          order.sizeDelta,
          order.keeperFeeBufferUsd
        );

        const { receipt, lastBaseFeePerGas } = await commitAndSettle(bs, marketId, trader, order);

        const keeperFee = getKeeperFee(BfpMarketProxy, receipt);
        const expectedKeeperFee = calcKeeperOrderSettlementFee(lastBaseFeePerGas);

        assertBn.equal(keeperFee, expectedKeeperFee);
        assertBn.equal(keeperFee, minKeeperFeeUsd);
      });
    });
  });
});
