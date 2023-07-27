import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import { bootstrap } from '../../bootstrap';
import { genBootstrap, genOrder } from '../../generators';
import { depositMargin } from '../../helpers';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { BigNumber } from 'ethers';

describe('OrderModule', () => {
  const bs = bootstrap(genBootstrap());
  const { systems, restore, provider } = bs;

  beforeEach(restore);

  describe('commitOrder', () => {
    it('should successfully commit order with no existing position', async () => {
      const { PerpMarketProxy } = systems();

      // Perform the deposit.
      const { trader, marketId, depositAmountDelta } = await depositMargin(bs);

      // Generate a valid order.
      const { minMarginUsd } = await PerpMarketProxy.getMarketParameters();
      const { maxLeverage } = await PerpMarketProxy.getMarketParametersById(marketId);
      const oraclePrice = await PerpMarketProxy.getOraclePrice(marketId);
      const { sizeDelta, limitPrice, keeperFeeBufferUsd } = genOrder(
        depositAmountDelta,
        maxLeverage,
        minMarginUsd,
        oraclePrice
      );

      // Perform the commitment.
      const tx = await PerpMarketProxy.connect(trader.signer).commitOrder(
        trader.accountId,
        marketId,
        sizeDelta,
        limitPrice,
        keeperFeeBufferUsd
      );
      const receipt = await tx.wait();
      const block = await provider().getBlock(receipt.blockNumber);

      // NOTE: Partial match, just to confirm the order was successfully emitted.
      //
      // The last 2 arguments are fees on the order, which is tested separately. `assertRevert`, despite calling `text.match`
      // does not allow a regex expression... so this will have to change in the future.
      const expectedEvent = `OrderSubmitted(${trader.accountId}, ${marketId}, ${sizeDelta}, ${block.timestamp}`;
      await assertEvent(tx, expectedEvent, PerpMarketProxy);
    });

    it('should successfully commit order that completely closes existing position');
    it('should successfully commit order that partially closes existing');
    it('should successfully commit order that adds to an existing order');
    it('should successfully commit order that flips from one side to the other');

    it('should recompute funding on commitment');

    it('should revert when market is paused');

    it('should revert when there is insufficient margin');

    it('should revert when an order already present', async () => {
      const { PerpMarketProxy } = systems();

      // Perform the deposit.
      const { trader, marketId, depositAmountDelta } = await depositMargin(bs);

      // Generate a valid order.
      const { minMarginUsd } = await PerpMarketProxy.getMarketParameters();
      const { maxLeverage } = await PerpMarketProxy.getMarketParametersById(marketId);
      const oraclePrice = await PerpMarketProxy.getOraclePrice(marketId);
      const order1 = genOrder(depositAmountDelta, maxLeverage, minMarginUsd, oraclePrice);

      // Perform the commitment (success)
      await PerpMarketProxy.connect(trader.signer).commitOrder(
        trader.accountId,
        marketId,
        order1.sizeDelta,
        order1.limitPrice,
        order1.keeperFeeBufferUsd
      );

      const order2 = genOrder(depositAmountDelta, maxLeverage, minMarginUsd, oraclePrice);

      // Perform commitment but expect fail as order already exists.
      await assertRevert(
        PerpMarketProxy.connect(trader.signer).commitOrder(
          trader.accountId,
          marketId,
          order2.sizeDelta,
          order2.limitPrice,
          order2.keeperFeeBufferUsd
        ),
        `OrderFound("${trader.accountId}")`,
        PerpMarketProxy
      );
    });

    it('should revert when this order exceeds maxMarketSize (oi)');

    it('should revert when sizeDelta is 0', async () => {
      const { PerpMarketProxy } = systems();

      // Perform the deposit.
      const { trader, marketId, depositAmountDelta } = await depositMargin(bs);

      const { minMarginUsd } = await PerpMarketProxy.getMarketParameters();
      const { maxLeverage } = await PerpMarketProxy.getMarketParametersById(marketId);
      const oraclePrice = await PerpMarketProxy.getOraclePrice(marketId);
      const { limitPrice, keeperFeeBufferUsd } = genOrder(depositAmountDelta, maxLeverage, minMarginUsd, oraclePrice);

      // Perform the commitment (everything valid except for sizeDelta = 0).
      await assertRevert(
        PerpMarketProxy.connect(trader.signer).commitOrder(
          trader.accountId,
          marketId,
          BigNumber.from(0),
          limitPrice,
          keeperFeeBufferUsd
        ),
        'NilOrder()',
        PerpMarketProxy
      );
    });

    it('should revert when an existing position can be liquidated');
    it('should revert when maxLeverage is exceeded');

    it('should revert when accountId does not exist', async () => {
      const { PerpMarketProxy } = systems();

      // Perform the deposit.
      const { trader, marketId, depositAmountDelta } = await depositMargin(bs);

      const { minMarginUsd } = await PerpMarketProxy.getMarketParameters();
      const { maxLeverage } = await PerpMarketProxy.getMarketParametersById(marketId);
      const oraclePrice = await PerpMarketProxy.getOraclePrice(marketId);
      const { sizeDelta, limitPrice, keeperFeeBufferUsd } = genOrder(
        depositAmountDelta,
        maxLeverage,
        minMarginUsd,
        oraclePrice
      );

      const invalidAccountId = 69420;
      await assertRevert(
        PerpMarketProxy.connect(trader.signer).commitOrder(
          invalidAccountId,
          marketId,
          sizeDelta,
          limitPrice,
          keeperFeeBufferUsd
        ),
        `AccountNotFound("${invalidAccountId}")`,
        PerpMarketProxy
      );
    });

    it('should revert when marketId does not exist', async () => {
      const { PerpMarketProxy } = systems();

      // Perform the deposit.
      const { trader, marketId, depositAmountDelta } = await depositMargin(bs);

      const { minMarginUsd } = await PerpMarketProxy.getMarketParameters();
      const { maxLeverage } = await PerpMarketProxy.getMarketParametersById(marketId);
      const oraclePrice = await PerpMarketProxy.getOraclePrice(marketId);
      const { sizeDelta, limitPrice, keeperFeeBufferUsd } = genOrder(
        depositAmountDelta,
        maxLeverage,
        minMarginUsd,
        oraclePrice
      );

      const invalidMarketId = 69420;
      await assertRevert(
        PerpMarketProxy.connect(trader.signer).commitOrder(
          trader.accountId,
          invalidMarketId,
          sizeDelta,
          limitPrice,
          keeperFeeBufferUsd
        ),
        `MarketNotFound("${invalidMarketId}")`,
        PerpMarketProxy
      );
    });
  });

  describe('settleOrder', () => {
    it('should successfully settle an order that exists');
    it('should successfully settle an order that completely closes existing position');
    it('should successfully settle an order that partially closes existing');
    it('should successfully settle an order that adds to an existing order');
    it('should successfully settle an order that flips from one side to the other');

    it('should successfully commit order if price moves but still safe');

    it('should recompute funding on settlement');

    it('should revert when market is paused');
    it('should revert when this order exceeds maxMarketSize (oi)');
    it('should revert when sizeDelta is 0');
    it('should revert when an existing position can be liquidated');
    it('should revert when maxLeverage is exceeded');
    it('should revert when accountId does not exist');
    it('should revert when marketId does not exist');
    it('should revert if not enough time has passed');
    it('should revert if order is stale');

    // NOTE: This may not be necessary.
    it('should revert when price deviations exceed threshold');

    it('should revert when price is zero (i.e. invalid)');
    it('should revert if off-chain pyth publishTime is not within acceptance window');
    it('should revert if vaa merkle or vaa blob is invalid');
    it('should revert when not enough wei is available to pay pyth fee');
  });

  describe('getOrderFee', () => {});

  describe('getOrderKeeperFee', () => {});

  describe('getFillPrice', () => {});
});
