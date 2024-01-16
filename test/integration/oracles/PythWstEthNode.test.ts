import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { wei } from '@synthetixio/wei';
import { bootstrap } from '../../bootstrap';
import { bn, genBootstrap, genNumber, genOneOf, genOrder, genTrader } from '../../generators';
import {
  commitAndSettle,
  depositMargin,
  getPythPriceData,
  getSusdCollateral,
  setMarketConfiguration,
  setMarketConfigurationById,
} from '../../helpers';

describe.only('PythWstEthNode', () => {
  const bs = bootstrap(genBootstrap());
  const { systems, markets, collaterals, collateralsWithoutSusd, extras, restore, spotMarket, provider, keeper } = bs;

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

    it('should be zero if wstETH<>stETH exchange is zero', async () => {
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

    it('should be zero if stETH<>ETH exchange rate is zero', async () => {
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

    it('should sell collateral on a losing pnl settlement with configured PythWstEthNode', async () => {
      const { PerpMarketProxy, PythMock, OracleManager, SpotMarket } = systems();
      const { pythWstEthNodeId } = extras();
      const { wstEthToEth, stEthToETh } = await configureExchangeRatios(1, 1);
      const { priceFeedId, market, marketId } = await getMarketMetadata();

      // Give a price to the swstETH collateral.
      const ethPrice = 1000;
      const { updateData, updateFee } = await getPythPriceData(bs, ethPrice, priceFeedId);
      await PythMock.updatePriceFeeds([updateData], { value: updateFee });

      // Reconfigure the collateral (only one) with this oracle node.
      //
      // (1) Update the collateral on L1 perp with new oracleNodeId (ensuring we also have sUSD).
      const collateral = { ...genOneOf(collateralsWithoutSusd()) };
      collateral.oracleNodeId = () => pythWstEthNodeId;
      collateral.getPrice = async () => {
        const { price } = await OracleManager.process(pythWstEthNodeId);
        return price;
      };

      const sUsdCollateral = getSusdCollateral(collaterals());

      const synthMarketIds = [sUsdCollateral.synthMarketId(), collateral.synthMarketId()];
      const oracleNodeIds = [sUsdCollateral.oracleNodeId(), collateral.oracleNodeId()];
      const maxAllowables = [sUsdCollateral.max, collateral.max];
      const rewardDistributors = [sUsdCollateral.rewardDistributorAddress(), collateral.rewardDistributorAddress()];

      await PerpMarketProxy.setCollateralConfiguration(
        synthMarketIds,
        oracleNodeIds,
        maxAllowables,
        rewardDistributors
      );

      // (2) Update the synth priceFeedId on both buy/sell with new oracleNodeId.
      await SpotMarket.connect(spotMarket.marketOwner()).updatePriceData(
        collateral.synthMarketId(),
        pythWstEthNodeId,
        pythWstEthNodeId,
        // @ts-ignore
        60 // Types misaligned due to spot market not compiling latest types.
      );
      await SpotMarket.connect(spotMarket.marketOwner()).setMarketSkewScale(collateral.synthMarketId(), bn(0));

      // (3) Update the pythPriceFeedId to be the same pythPriceFeed as the ETH Pyth price feed so updates work.
      // (4) Static market to make accounting easier on the collateral sale.
      await setMarketConfigurationById(bs, marketId, {
        pythPriceFeedId: priceFeedId,
        takerFee: bn(0),
        makerFee: bn(0),
        maxFundingVelocity: bn(0),
      });
      await setMarketConfiguration(bs, { minKeeperFeeUsd: bn(0), maxKeeperFeeUsd: bn(0) });

      // (4) [TMP] Update the oracleNodeId (currently CL) to be the same price as the underlying ETH pythPrice.
      //
      // TODO: Change when oracleNodeId is always a Pyth price and/or if we remove `isPriceDivergenceExceeded`.
      await market.aggregator().mockSetCurrentPrice(bn(ethPrice));

      // Open a position (1x long).
      const { trader, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, { desiredCollateral: collateral, desiredMarket: market, desiredMarginUsdDepositAmount: 10_000 })
      );
      const openOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSide: 1,
        desiredLeverage: 1,
        desiredKeeperFeeBufferUsd: 0,
      });

      // Note: Because the collateral is the same oracle as the market, both collateral and market is updated at the same time.
      await commitAndSettle(bs, marketId, trader, openOrder, {
        getPythData: (publishTime: number) => getPythPriceData(bs, ethPrice, priceFeedId, publishTime),
      });

      // Confirm the oracle price.
      const { price } = await OracleManager.process(pythWstEthNodeId);
      const expectedPrice = wei(ethPrice).mul(stEthToETh).mul(wstEthToEth).toBN();
      assertBn.near(price, expectedPrice, bn(0.000001));

      // Confirm the position has been opened.
      const position = await PerpMarketProxy.getPositionDigest(trader.accountId, marketId);
      assertBn.equal(position.size, openOrder.sizeDelta);

      // Tank the ETH price by 5%. Position should be in negative PnL. Note that a 5% price drop
      // also impacts the collateral value.
      //
      // For example, ignoring price impact and fees:
      //
      // - 10 wstETH = $950 per wstETH
      // - $500 to cover
      // - 0.52631579 wstETH must be sold to cover.
      // - 9.47368421 remains
      // - ~10% loss
      const nextEthPrice = ethPrice * 0.95;

      // TODO: This also may not be needed after removing `isPriceDivergenceExceeded`.
      await market.aggregator().mockSetCurrentPrice(bn(nextEthPrice));

      // Close the position, the settlement should update the price.
      const closeOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSize: wei(openOrder.sizeDelta).mul(-1).toBN(),
        desiredKeeperFeeBufferUsd: 0,
      });

      await commitAndSettle(bs, marketId, trader, closeOrder, {
        getPythData: (publishTime: number) => getPythPriceData(bs, nextEthPrice, priceFeedId, publishTime),
      });

      // Confirm position is fully closed.
      const d = await PerpMarketProxy.getAccountDigest(trader.accountId, marketId);
      assertBn.isZero(d.position.size);

      const size = openOrder.sizeDelta;
      const marginLossUsd = wei(size).mul(openOrder.fillPrice.sub(closeOrder.fillPrice));
      const amountCollateralToSell = marginLossUsd.div(bn(nextEthPrice));
      const amountRemaining = wei(size).sub(amountCollateralToSell);
      const amountRemainingUsd = amountRemaining.mul(bn(nextEthPrice)).toBN();

      assertBn.near(amountRemainingUsd, d.collateralUsd, bn(0.00001));
    });
  });
});
