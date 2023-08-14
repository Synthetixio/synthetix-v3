import { BigNumber } from 'ethers';
import { PerpMarketConfiguration } from './generated/typechain/MarketConfigurationModule';
import type { bootstrap } from './bootstrap';
import type { genTrader } from './generators';

// --- Mutative helpers --- //

type Bs = ReturnType<typeof bootstrap>;

/** Given generated trade meta, deposit collateral and return trader. */
export const depositMargin = async (bs: Bs, tr: ReturnType<typeof genTrader>) => {
  const { trader, market, collateral, collateralDepositAmount } = await tr;
  const { PerpMarketProxy } = bs.systems();

  const collateralConnected = collateral.contract.connect(trader.signer);
  await collateralConnected.mint(trader.signer.getAddress(), collateralDepositAmount);
  await collateralConnected.approve(PerpMarketProxy.address, collateralDepositAmount);

  // Perform the deposit
  const tx = await PerpMarketProxy.connect(trader.signer).modifyCollateral(
    trader.accountId,
    market.marketId(),
    collateral.contract.address,
    collateralDepositAmount
  );
  await tx.wait();

  return tr;
};

/** Generic update on market specific params */
export const setMarketConfigurationById = async (
  bs: ReturnType<typeof bootstrap>,
  marketId: BigNumber,
  params: Partial<PerpMarketConfiguration.DataStruct>
) => {
  const { systems, owner } = bs;
  const { PerpMarketProxy } = systems();

  const data = await PerpMarketProxy.getMarketConfigurationById(marketId);
  const tx = await PerpMarketProxy.connect(owner()).setMarketConfigurationById(marketId, { ...data, ...params });
  await tx.wait();

  return await PerpMarketProxy.getMarketConfigurationById(marketId);
};

/** Update market's Pyth and CL oracle price, given the price and time of update. */
export const getPythPriceData = async (
  bs: ReturnType<typeof bootstrap>,
  marketId: BigNumber,
  price: number,
  publishTime?: number,
  priceExpo = -4,
  priceConfidence = 1
) => {
  const { systems } = bs;
  const { PythMock, PerpMarketProxy } = systems();

  const config = await PerpMarketProxy.getMarketConfigurationById(marketId);
  const updateData = await PythMock.createPriceFeedUpdateData(
    config.pythPriceFeedId,
    price,
    priceConfidence,
    priceExpo,
    price,
    priceConfidence,
    publishTime ?? Math.floor(Date.now() / 1000)
  );
  const updateFee = await PythMock.getUpdateFee([updateData]);

  return { updateData, updateFee };
};
