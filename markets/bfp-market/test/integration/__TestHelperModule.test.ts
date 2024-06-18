import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { bootstrap } from '../bootstrap';
import { genBootstrap, genOneOf } from '../generators';

describe('__TestHelperModule.test', () => {
  const bs = bootstrap(genBootstrap());
  const { markets, traders, systems, restore } = bs;

  beforeEach(restore);

  describe('__test_creditAccountMarginProfitUsd', () => {
    it('should revert when not owner', async () => {
      const { BfpMarketProxy } = systems();

      const trader = genOneOf(traders());
      const traderAddress = await trader.signer.getAddress();
      const market = genOneOf(markets());
      const marketId = market.marketId();

      await assertRevert(
        BfpMarketProxy.connect(trader.signer).__test_creditAccountMarginProfitUsd(
          trader.accountId,
          marketId,
          0
        ),
        `Unauthorized("${traderAddress}")`,
        BfpMarketProxy
      );
    });
  });

  describe('__test_addDebtUsdToAccountMargin', () => {
    it('should revert when not owner', async () => {
      const { BfpMarketProxy } = systems();

      const trader = genOneOf(traders());
      const traderAddress = await trader.signer.getAddress();
      const market = genOneOf(markets());
      const marketId = market.marketId();

      await assertRevert(
        BfpMarketProxy.connect(trader.signer).__test_addDebtUsdToAccountMargin(
          trader.accountId,
          marketId,
          0
        ),
        `Unauthorized("${traderAddress}")`,
        BfpMarketProxy
      );
    });
  });
});
