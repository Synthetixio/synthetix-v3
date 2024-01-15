import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { wei } from '@synthetixio/wei';
import { bootstrap } from '../../bootstrap';
import { bn, genBootstrap, genNumber } from '../../generators';
import { getPythPriceData } from '../../helpers';

describe.only('PythWstEthNode', () => {
  const bs = bootstrap(genBootstrap());
  const { systems, markets, extras, restore } = bs;

  beforeEach(restore);

  describe('process', () => {
    const configureExchangeRatios = async (desiredWstEthToEth?: number, desiredStEthToEth?: number) => {
      const { WstETHMock, StEthToEthMock } = systems();

      const wstEthToEth = bn(desiredWstEthToEth ?? genNumber(1.1, 1.2));
      const stEthToETh = bn(desiredStEthToEth ?? genNumber(0.98, 1.02));

      await WstETHMock.mockSetWstEthToStEthRatio(wstEthToEth);
      await StEthToEthMock.mockSetCurrentPrice(stEthToETh);

      return { wstEthToEth, stEthToETh };
    };

    const getMarketMetadata = async () => {
      const { PerpMarketProxy } = systems();

      const market = markets()[1]; // ETHPERP.
      const marketId = market.marketId();
      const priceFeedId = (await PerpMarketProxy.getMarketConfigurationById(marketId)).pythPriceFeedId;

      return { market, marketId, priceFeedId };
    };

    it('should compute zero price when no prices available', async () => {
      const { OracleManager } = systems();
      const { pythWstEthNodeId } = extras();
      const { price } = await OracleManager.process(pythWstEthNodeId);
      assertBn.isZero(price);
    });

    it('should compute a wstETH price (concrete)', async () => {
      const { OracleManager, PythMock } = systems();
      const { pythWstEthNodeId } = extras();

      const { wstEthToEth, stEthToETh } = await configureExchangeRatios(1.153, 0.99);
      const { priceFeedId } = await getMarketMetadata();

      const ethPrice = 2586;
      const { updateData, updateFee } = await getPythPriceData(bs, ethPrice, priceFeedId);
      await PythMock.updatePriceFeeds([updateData], { value: updateFee });

      // 2586 * 1.153 * 0.99 = 2951.84142 wstETH
      const { price } = await OracleManager.process(pythWstEthNodeId);
      const expectedPrice = wei(ethPrice).mul(stEthToETh).mul(wstEthToEth).toBN();

      assertBn.near(price, expectedPrice, bn(0.000001));
    });

    // Same as the compute test above but with random data.
    it('should compute a wstETH price', async () => {
      const { OracleManager, PythMock } = systems();
      const { pythWstEthNodeId } = extras();

      const { wstEthToEth, stEthToETh } = await configureExchangeRatios();
      const { priceFeedId } = await getMarketMetadata();

      const ethPrice = genNumber(1800, 10_000);
      const { updateData, updateFee } = await getPythPriceData(bs, ethPrice, priceFeedId);
      await PythMock.updatePriceFeeds([updateData], { value: updateFee });

      const { price } = await OracleManager.process(pythWstEthNodeId);
      const expectedPrice = wei(ethPrice).mul(stEthToETh).mul(wstEthToEth).toBN();

      assertBn.near(price, expectedPrice, bn(0.000001));
    });

    it('should be zero if the Pyth price is zero', async () => {
      const { OracleManager, PythMock } = systems();
      const { pythWstEthNodeId } = extras();

      await configureExchangeRatios();
      const { priceFeedId } = await getMarketMetadata();

      const ethPrice = 0;
      const { updateData, updateFee } = await getPythPriceData(bs, ethPrice, priceFeedId);
      await PythMock.updatePriceFeeds([updateData], { value: updateFee });

      const { price } = await OracleManager.process(pythWstEthNodeId);
      assertBn.isZero(price);
    });

    it('should revert if wstETH<>stETH exchange is zero', async () => {
      const { OracleManager, PythMock } = systems();
      const { pythWstEthNodeId } = extras();

      await configureExchangeRatios(0, undefined);
      const { priceFeedId } = await getMarketMetadata();

      const ethPrice = genNumber(1800, 10_000);
      const { updateData, updateFee } = await getPythPriceData(bs, ethPrice, priceFeedId);
      await PythMock.updatePriceFeeds([updateData], { value: updateFee });

      const { price } = await OracleManager.process(pythWstEthNodeId);
      assertBn.isZero(price);
    });

    it('should revert if stETH<>ETH exchange rate is zero', async () => {
      const { OracleManager, PythMock } = systems();
      const { pythWstEthNodeId } = extras();

      await configureExchangeRatios(undefined, 0);
      const { priceFeedId } = await getMarketMetadata();

      const ethPrice = genNumber(1800, 10_000);
      const { updateData, updateFee } = await getPythPriceData(bs, ethPrice, priceFeedId);
      await PythMock.updatePriceFeeds([updateData], { value: updateFee });

      const { price } = await OracleManager.process(pythWstEthNodeId);
      assertBn.isZero(price);
    });

    it('should sell collateral on a losing pnl settlement with Pyth PythWstEthNode');

    // Not sure if this can ever occur if Spot market Synth oracle is the same as the Perp wstETH collateral...
    it('should revert on sale of collateral when Pyth oracle price is stale');
  });
});
