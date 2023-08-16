import { BigNumber } from 'ethers';
import { PerpMarketConfiguration } from './generated/typechain/MarketConfigurationModule';
import type { bootstrap } from './bootstrap';
import { type genTrader, type genOrder, genNumber } from './generators';
import { wei } from '@synthetixio/wei';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';

// --- Mutative helpers --- //

type Bs = ReturnType<typeof bootstrap>;

/** Returns a generated trader with collateral and market details. */
export const depositMargin = async (bs: Bs, tr: ReturnType<typeof genTrader>) => {
  const { trader, market, collateral, collateralDepositAmount } = await tr;
  const { PerpMarketProxy } = bs.systems();

  const collateralConnected = collateral.contract.connect(trader.signer);
  await collateralConnected.mint(trader.signer.getAddress(), collateralDepositAmount);
  await collateralConnected.approve(PerpMarketProxy.address, collateralDepositAmount);

  // Perform the deposit
  await PerpMarketProxy.connect(trader.signer).modifyCollateral(
    trader.accountId,
    market.marketId(),
    collateral.contract.address,
    collateralDepositAmount
  );

  return tr;
};

/** Generic update on market specific params. */
export const setMarketConfigurationById = async (
  bs: ReturnType<typeof bootstrap>,
  marketId: BigNumber,
  params: Partial<PerpMarketConfiguration.DataStruct>
) => {
  const { systems, owner } = bs;
  const { PerpMarketProxy } = systems();

  const data = await PerpMarketProxy.getMarketConfigurationById(marketId);
  await PerpMarketProxy.connect(owner()).setMarketConfigurationById(marketId, { ...data, ...params });

  return await PerpMarketProxy.getMarketConfigurationById(marketId);
};

/** Returns a Pyth updateData blob and the update fee in wei. */
export const getPythPriceData = async (
  bs: ReturnType<typeof bootstrap>,
  marketId: BigNumber,
  price: number,
  publishTime?: number,
  priceExpo = 6,
  priceConfidence = 1
) => {
  const { systems } = bs;
  const { PythMock, PerpMarketProxy } = systems();

  const pythPrice = wei(price, priceExpo).toBN();
  const config = await PerpMarketProxy.getMarketConfigurationById(marketId);
  const updateData = await PythMock.createPriceFeedUpdateData(
    config.pythPriceFeedId,
    pythPrice,
    priceConfidence,
    -priceExpo,
    pythPrice,
    priceConfidence,
    publishTime ?? Math.floor(Date.now() / 1000)
  );
  const updateFee = await PythMock.getUpdateFee([updateData]);

  return { updateData, updateFee };
};

/** Commits a generated `order` for `trader` on `marketId` and settles successfully. */
export const commitAndSettle = async (
  bs: ReturnType<typeof bootstrap>,
  marketId: BigNumber,
  trader: ReturnType<Bs['traders']>[number],
  order: Awaited<ReturnType<typeof genOrder>>
) => {
  const { PerpMarketProxy } = bs.systems();
  await PerpMarketProxy.connect(trader.signer).commitOrder(
    trader.accountId,
    marketId,
    order.sizeDelta,
    order.limitPrice,
    order.keeperFeeBufferUsd
  );
  const pendingOrder = await PerpMarketProxy.getOrder(trader.accountId, marketId);

  const commitmentTime = pendingOrder.commitmentTime.toNumber();
  const config = await PerpMarketProxy.getMarketConfiguration();
  const minOrderAge = config.minOrderAge.toNumber();
  const pythPublishTimeMin = config.pythPublishTimeMin.toNumber();
  const pythPublishTimeMax = config.pythPublishTimeMax.toNumber();

  // PublishTime is allowed to be between settlement - [0, maxAge - minAge]. For example, `[0, 12 - 8] = [0, 4]`.
  const publishTimeDelta = genNumber(0, pythPublishTimeMax - pythPublishTimeMin);
  const settlementTime = commitmentTime + minOrderAge;
  const publishTime = settlementTime - publishTimeDelta;

  const oraclePrice = wei(await PerpMarketProxy.getOraclePrice(marketId)).toNumber();
  const { updateData, updateFee } = await getPythPriceData(bs, marketId, oraclePrice, publishTime);

  await fastForwardTo(settlementTime, bs.provider());

  return PerpMarketProxy.connect(bs.keeper()).settleOrder(trader.accountId, marketId, [updateData], {
    value: updateFee,
  });
};
