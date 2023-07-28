import { BigNumber } from 'ethers';
import { bootstrap } from './bootstrap';
import { bn, genInt, genOneOf } from './generators';
import { PerpMarketConfiguration } from './generated/typechain/MarketConfigurationModule';
import { wei } from '@synthetixio/wei';

export const depositMargin = async (bs: ReturnType<typeof bootstrap>, depositAmount?: BigNumber) => {
  const { systems, traders, markets, collaterals } = bs;

  const { PerpMarketProxy } = systems();

  // Preamble
  const trader = traders()[0];
  const traderAddress = await trader.signer.getAddress();
  const market = genOneOf(markets());
  const marketId = market.marketId();

  // Collateral configuration
  const collateral = genOneOf(collaterals());

  const { answer: collateralPrice } = await collateral.aggregator().latestRoundData();
  const depositAmountDelta = depositAmount ?? bn(genInt(100, 200));
  const depositAmountDeltaUsd = wei(depositAmountDelta.abs()).mul(wei(collateralPrice)).toBN();

  const collateralConnected = collateral.contract.connect(trader.signer);
  await collateralConnected.mint(trader.signer.getAddress(), depositAmountDelta);
  await collateralConnected.approve(PerpMarketProxy.address, depositAmountDelta);

  // Perform the deposit
  const tx = await PerpMarketProxy.connect(trader.signer).transferTo(
    trader.accountId,
    marketId,
    collateral.contract.address,
    depositAmountDelta
  );
  await tx.wait();

  return { trader, traderAddress, market, marketId, depositAmountDelta, depositAmountDeltaUsd, collateral };
};

export const setMarketConfigurationById = async (
  bs: ReturnType<typeof bootstrap>,
  marketId: BigNumber,
  params: Partial<PerpMarketConfiguration.DataStruct>
) => {
  const { systems, owner } = bs;
  const { PerpMarketProxy } = systems();

  const data = await PerpMarketProxy.getMarketParametersById(marketId);
  const tx = await PerpMarketProxy.connect(owner()).setMarketConfigurationById(marketId, { ...data, ...params });
  await tx.wait();

  return await PerpMarketProxy.getMarketParametersById(marketId);
};
