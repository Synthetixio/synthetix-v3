import { wei } from '@synthetixio/wei';
import { bootstrap } from '../../bootstrap';
import { bn, genBootstrap, genInt, genOneOf, genOrder } from '../../generators';
import { depositMargin } from '../../helpers';

describe.only('OrderModule', () => {
  const bs = bootstrap(genBootstrap());
  const { markets, collaterals, traders, owner, systems, restore } = bs;

  beforeEach(restore);

  describe('commitOrder', () => {
    it('should successfully commit order with no existing position', async () => {
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

      const tx = await PerpMarketProxy.connect(trader.signer).commitOrder(
        trader.accountId,
        marketId,
        sizeDelta.toBN(),
        limitPrice,
        keeperFeeBufferUsd
      );

      console.log(tx);
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
