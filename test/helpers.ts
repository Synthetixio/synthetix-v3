import { BigNumber } from 'ethers';
import { bootstrap } from './bootstrap';
import { bn, genInt, genOneOf } from './generators';
import { PerpMarketConfiguration } from './generated/typechain/MarketConfigurationModule';
import { wei } from '@synthetixio/wei';

type Bs = ReturnType<typeof bootstrap>;
type Collateral = ReturnType<Bs['collaterals']>[number];

export const depositMargin = async (bs: Bs, depositAmount?: BigNumber, desiredCollateral?: Collateral) => {
  const { systems, traders, markets, collaterals } = bs;

  const { PerpMarketProxy } = systems();

  // Preamble
  const trader = traders()[0];
  const traderAddress = await trader.signer.getAddress();
  const market = genOneOf(markets());
  const marketId = market.marketId();
  const collateral = desiredCollateral ?? genOneOf(collaterals());

  // We use a large enough min range on depositAmountDelta to ensure we meet minMarginReq.
  const { answer: collateralPrice } = await collateral.aggregator().latestRoundData();

  // Don't deposit more size than the market can handle unless `depositAmount` is explicitly specified.
  const { maxMarketSize, maxLeverage } = await PerpMarketProxy.getMarketConfigurationById(marketId);
  const maxDepositAmountDelta = Math.floor(wei(maxMarketSize).div(maxLeverage).toNumber());
  const depositAmountDelta = depositAmount ?? bn(Math.min(genInt(100, 500), maxDepositAmountDelta));
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

  const data = await PerpMarketProxy.getMarketConfigurationById(marketId);
  const tx = await PerpMarketProxy.connect(owner()).setMarketConfigurationById(marketId, { ...data, ...params });
  await tx.wait();

  return await PerpMarketProxy.getMarketConfigurationById(marketId);
};
