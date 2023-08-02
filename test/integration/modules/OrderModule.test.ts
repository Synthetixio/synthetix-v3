import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import { bootstrap } from '../../bootstrap';
import { bn, genBootstrap, genInt, genOneOf, genOrder } from '../../generators';
import { depositMargin, setMarketConfigurationById } from '../../helpers';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { BigNumber } from 'ethers';
import { wei } from '@synthetixio/wei';

describe('OrderModule', () => {
  const bs = bootstrap(genBootstrap());
  const { systems, restore, provider, collaterals, markets } = bs;

  beforeEach(restore);

  describe('commitOrder', () => {
    it.only('should successfully commit order with no existing position', async () => {
      const { PerpMarketProxy } = systems();

      // Perform the deposit.
      const { trader, marketId, depositAmountDeltaUsd } = await depositMargin(bs);

      // Generate a valid order.
      const { sizeDelta, limitPrice, keeperFeeBufferUsd, oraclePrice } = await genOrder(
        PerpMarketProxy,
        marketId,
        depositAmountDeltaUsd
      );

      // Perform the commitment.
      console.log('size', wei(sizeDelta).toNumber());
      console.log('oraclePrice', wei(oraclePrice).toNumber());
      console.log('depositAmountDeltaUsd', wei(depositAmountDeltaUsd).toNumber());

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

    it('should successfully commit using max leverage');

    it('should recompute funding on commitment');

    it('should revert when market is paused');

    it('should revert insufficient margin when margin is less than min margin req', async () => {
      const { PerpMarketProxy } = systems();

      // Perform a deposit where margin < minMargin.
      //
      // - get value of collateral e.g. $1200
      // - get minMargin e.g. $100
      // - derive depositAmount e.g. $100 / $1200 = 0.08333334 units
      const market = genOneOf(markets());
      const collateral = genOneOf(collaterals());

      // TODO: Totally broken.
      const { minMarginUsd } = await PerpMarketProxy.getMarketConfigurationById(market.marketId());
      const { answer: collateralPrice } = await collateral.aggregator().latestRoundData();
      const depositAmount = wei(minMarginUsd).div(collateralPrice).mul(0.95).toBN(); // 5% less than minMargin.
      const { trader, marketId, depositAmountDeltaUsd } = await depositMargin(bs, depositAmount, collateral, market);

      // Generate a valid order that uses all available margin.
      const { sizeDelta, limitPrice, keeperFeeBufferUsd } = await genOrder(
        PerpMarketProxy,
        marketId,
        depositAmountDeltaUsd,
        { min: 1, max: 1 }
      );

      // Margin does not meet minMargin req
      await assertRevert(
        PerpMarketProxy.connect(trader.signer).commitOrder(
          trader.accountId,
          marketId,
          sizeDelta,
          limitPrice,
          keeperFeeBufferUsd
        ),
        'InsufficientMargin()',
        PerpMarketProxy
      );

      // However, should _not_ revert if margin eq minMargin.
    });

    it('should revert when an order already present', async () => {
      const { PerpMarketProxy } = systems();

      // Perform the deposit.
      const { trader, marketId, depositAmountDeltaUsd } = await depositMargin(bs);

      // Perform first commitment (success)
      const order1 = await genOrder(PerpMarketProxy, marketId, depositAmountDeltaUsd, { min: 1, max: 1 });
      await PerpMarketProxy.connect(trader.signer).commitOrder(
        trader.accountId,
        marketId,
        order1.sizeDelta,
        order1.limitPrice,
        order1.keeperFeeBufferUsd
      );

      // Perform another commitment but expect fail as order already exists.
      const order2 = await genOrder(PerpMarketProxy, marketId, depositAmountDeltaUsd, { min: 0.1, max: 0.1 });
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

    it('should revert when this order exceeds maxMarketSize (oi)', async () => {
      const { PerpMarketProxy } = systems();

      // Deposit margin to perp market.
      const depositAmountDelta = bn(genInt(10, 50));
      const { trader, marketId, depositAmountDeltaUsd } = await depositMargin(bs, depositAmountDelta);

      // Update the market's maxMarketSize to be just slightly below depositAmountDelta.
      await setMarketConfigurationById(bs, marketId, {
        maxMarketSize: depositAmountDelta.sub(wei(1).toBN()),
        maxLeverage: wei(1000).toBN(), // Large enough maxLeverage to avoid this error.
      });

      // Generate a valid order.
      const { limitPrice, keeperFeeBufferUsd } = await genOrder(PerpMarketProxy, marketId, depositAmountDeltaUsd);

      await assertRevert(
        PerpMarketProxy.connect(trader.signer).commitOrder(
          trader.accountId,
          marketId,
          depositAmountDelta, // 1x leverage but above maxMarketSize.
          limitPrice,
          keeperFeeBufferUsd
        ),
        'MaxMarketSizeExceeded()',
        PerpMarketProxy
      );
    });

    it('should revert when sizeDelta is 0', async () => {
      const { PerpMarketProxy } = systems();

      // Perform the deposit.
      const { trader, marketId, depositAmountDeltaUsd } = await depositMargin(bs);

      // Generate order.
      const { limitPrice, keeperFeeBufferUsd } = await genOrder(PerpMarketProxy, marketId, depositAmountDeltaUsd, {
        min: 1,
        max: 1,
      });

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

    it('should revert when maxLeverage is exceeded', async () => {
      const { PerpMarketProxy } = systems();

      // Deposit margin to perp market.
      const { trader, marketId, depositAmountDeltaUsd } = await depositMargin(bs);

      // Generate an order where the leverage is between maxLeverage + 1 and maxLeverage * 2.
      const { maxLeverage } = await PerpMarketProxy.getMarketConfigurationById(marketId);
      const { sizeDelta, limitPrice, keeperFeeBufferUsd } = await genOrder(
        PerpMarketProxy,
        marketId,
        depositAmountDeltaUsd,
        {
          min: wei(maxLeverage).toNumber() + 1,
          max: wei(maxLeverage).mul(2).toNumber(),
        }
      );

      // TODO: Use fillPrice, orderFees, and keeperFees to get exact leverage amount.
      await assertRevert(
        PerpMarketProxy.connect(trader.signer).commitOrder(
          trader.accountId,
          marketId,
          sizeDelta,
          limitPrice,
          keeperFeeBufferUsd
        ),
        `MaxLeverageExceeded`,
        PerpMarketProxy
      );
    });

    it('should revert when accountId does not exist', async () => {
      const { PerpMarketProxy } = systems();

      // Perform the deposit.
      const { trader, marketId, depositAmountDeltaUsd } = await depositMargin(bs);

      // Generate order.
      const { sizeDelta, limitPrice, keeperFeeBufferUsd } = await genOrder(
        PerpMarketProxy,
        marketId,
        depositAmountDeltaUsd
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
      const { trader, marketId, depositAmountDeltaUsd } = await depositMargin(bs);

      // Generate order.
      const { sizeDelta, limitPrice, keeperFeeBufferUsd } = await genOrder(
        PerpMarketProxy,
        marketId,
        depositAmountDeltaUsd
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
    it('should allow position reduction even if insufficient unless in liquidation');

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

    it('should revert if long exceeds limit price');
    it('should revert if short exceeds limit price');

    it('should revert if collateral price slips into insufficient margin on between commit and settle');
    it('should revert if collateral price slips into maxMarketSize between commit and settle');

    // NOTE: This may not be necessary.
    it('should revert when price deviations exceed threshold');

    it('should revert when price is zero (i.e. invalid)');
    it('should revert if off-chain pyth publishTime is not within acceptance window');
    it('should revert if pyth vaa merkle/blob is invalid');
    it('should revert when not enough wei is available to pay pyth fee');
  });

  describe('getOrderFee', () => {});

  describe('getOrderKeeperFee', () => {});

  describe('getFillPrice', () => {});
});
