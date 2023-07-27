import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import { bootstrap } from '../../bootstrap';
import { genBootstrap, genOrder } from '../../generators';
import { depositMargin } from '../../helpers';

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

    it('should recopmute funding on commitment');

    it('should revert when there is insufficient margin');
    it('should revert when an order already present');
    it('should revert when this order exceeds maxMarketSize (oi)');
    it('should revert when sizeDelta is 0');
    it('should revert when the resulting position can be liquidated');
    it('should revert when maxLeverage is exceeded');
    it('should revert when accountId does not exist');
    it('should revert when marketId does not exist');
  });

  describe('settleOrder', () => {});

  describe('getOrderFee', () => {});

  describe('getOrderKeeperFee', () => {});

  describe('getFillPrice', () => {});
});
