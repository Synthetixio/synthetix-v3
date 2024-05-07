import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { wei } from '@synthetixio/wei';
import { shuffle } from 'lodash';
import { bootstrap } from '../../bootstrap';
import {
  genBootstrap,
  genOneOf,
  genOrder,
  genTrader,
  toRoundRobinGenerators,
} from '../../generators';
import { commitAndSettle, depositMargin, getSusdCollateral } from '../../helpers';

describe('PerpMarketFactoryModule minimumCredit', () => {
  const bs = bootstrap(genBootstrap());
  const { traders, collaterals, collateralsWithoutSusd, systems, restore } = bs;

  beforeEach(restore);

  it('should include OI + sUSD collateral', async () => {
    const { BfpMarketProxy } = systems();
    const sUSDCollateral = getSusdCollateral(collaterals());
    const collateral = genOneOf(collateralsWithoutSusd());
    const tradersGenerator = toRoundRobinGenerators(shuffle(traders()));

    // Create a position with non sUSD collateral.
    const {
      trader: trader1,
      market,
      marketId,
      collateralDepositAmount,
    } = await depositMargin(
      bs,
      genTrader(bs, {
        desiredCollateral: collateral,
        desiredTrader: tradersGenerator.next().value,
      })
    );
    const order1 = await genOrder(bs, market, collateral, collateralDepositAmount);
    await commitAndSettle(bs, marketId, trader1, order1);

    // Create a position with sUSD collateral.
    const { trader: trader2, collateralDepositAmount: sUSDCollateralDepositAmount } =
      await depositMargin(
        bs,
        genTrader(bs, {
          desiredCollateral: sUSDCollateral,
          desiredTrader: tradersGenerator.next().value,
          desiredMarket: market,
        })
      );
    const order2 = await genOrder(bs, market, sUSDCollateral, sUSDCollateralDepositAmount);
    await commitAndSettle(bs, marketId, trader2, order2);

    const { minCreditPercent } = await BfpMarketProxy.getMarketConfigurationById(marketId);
    const oi = wei(order1.sizeDelta)
      .abs()
      .mul(order1.oraclePrice)
      .add(wei(order2.sizeDelta).abs().mul(order2.oraclePrice));
    const expectedMinCredit = oi.mul(minCreditPercent).add(sUSDCollateralDepositAmount);
    const minCredit = await BfpMarketProxy.minimumCredit(marketId);
    assertBn.equal(minCredit, expectedMinCredit.toBN());
  });
});
