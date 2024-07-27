import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { wei } from '@synthetixio/wei';
import { bootstrap } from '../../bootstrap';
import { bn, genBootstrap, genOneOf, genOrder, genSide, genTrader } from '../../generators';
import {
  depositMargin,
  commitAndSettle,
  setMarketConfigurationById,
  setBaseFeePerGas,
} from '../../helpers';
import { BigNumber } from 'ethers';

describe('LiquidationModule', () => {
  const bs = bootstrap(genBootstrap());
  const { systems, provider, restore } = bs;

  beforeEach(restore);

  afterEach(async () => await setBaseFeePerGas(1, provider()));

  describe('getHealthFactor', () => {
    it('should return expected healthFactor', async () => {
      const { BfpMarketProxy } = systems();

      // Commit, settle, place position into liquidation, flag for liquidation. Additionally, we set
      // `desiredMarginUsdDepositAmount` to a low~ish value to prevent partial liquidations.
      const orderSide = genSide();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, { desiredMarginUsdDepositAmount: genOneOf([2000, 3000, 5000]) })
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 10,
        desiredSide: orderSide,
      });
      await commitAndSettle(bs, marketId, trader, order);

      // Set a large enough liqCap to ensure a full liquidation.
      await setMarketConfigurationById(bs, marketId, { liquidationLimitScalar: bn(100) });

      const healthFactor1 = await BfpMarketProxy.getHealthFactor(trader.accountId, marketId);
      assertBn.gt(healthFactor1, wei(1).toBN());

      // Rekt.
      const newMarketOraclePrice = wei(order.oraclePrice)
        .mul(orderSide === 1 ? 0.89 : 1.11)
        .toBN();
      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

      const healthFactor2 = await BfpMarketProxy.getHealthFactor(trader.accountId, marketId);
      assertBn.lt(healthFactor2, wei(1).toBN());
    });

    it('should return max uint256 when no position found', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, marketId } = await depositMargin(bs, genTrader(bs));
      const healthFactor = await BfpMarketProxy.getHealthFactor(trader.accountId, marketId);

      const maxUint256 = BigNumber.from(2).pow(256).sub(1);
      assertBn.equal(healthFactor, maxUint256);
    });
  });
});
