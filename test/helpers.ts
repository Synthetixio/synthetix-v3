import { BigNumber } from 'ethers';
import { PerpMarketConfiguration } from './generated/typechain/MarketConfigurationModule';
import type { bootstrap } from './bootstrap';
import type { genTrader } from './generators';

// --- Mutative helpers --- //

type Bs = ReturnType<typeof bootstrap>;

export const depositMargin = async (bs: Bs, tr: ReturnType<typeof genTrader>) => {
  const { trader, market, collateral, collateralDepositAmount } = await tr;
  const { PerpMarketProxy } = bs.systems();

  const collateralConnected = collateral.contract.connect(trader.signer);
  await collateralConnected.mint(trader.signer.getAddress(), collateralDepositAmount);
  await collateralConnected.approve(PerpMarketProxy.address, collateralDepositAmount);

  // Perform the deposit
  const tx = await PerpMarketProxy.connect(trader.signer).transferTo(
    trader.accountId,
    market.marketId(),
    collateral.contract.address,
    collateralDepositAmount
  );
  await tx.wait();

  return tr;
};

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
