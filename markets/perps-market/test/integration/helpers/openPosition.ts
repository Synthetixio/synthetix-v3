import { ethers } from 'ethers';
import { Systems, toNum } from '../bootstrap';
import { fastForwardTo, getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { settleOrder } from '.';

export type OpenPositionData = {
  trader: ethers.Signer;
  marketId: ethers.BigNumber;
  accountId: number;
  sizeDelta: ethers.BigNumber;
  settlementStrategyId: number;
  price: ethers.BigNumber; // spot price if offchain price is defined
  offchiainPrice?: ethers.BigNumber; // if undefined will use price
  acceptablePrice?: ethers.BigNumber; // if undefined will use price
  trackingCode?: string;
  keeper: ethers.Signer;
  systems: () => Systems;
  provider: () => ethers.providers.JsonRpcProvider;
};

export const openPosition = async (data: OpenPositionData) => {
  const {
    systems,
    provider,
    trader,
    marketId,
    accountId,
    sizeDelta,
    settlementStrategyId,
    price,
    trackingCode,
    keeper,
  } = data;

  const strategy = await systems().PerpsMarket.getSettlementStrategy(
    data.marketId,
    data.settlementStrategyId
  );
  const delay = toNum(strategy.settlementDelay);

  const commitTx = await systems()
    .PerpsMarket.connect(trader)
    .commitOrder({
      marketId,
      accountId,
      sizeDelta,
      settlementStrategyId,
      acceptablePrice: price,
      trackingCode: trackingCode ?? ethers.constants.HashZero,
    });
  await commitTx.wait();

  const commitmentTime = await getTime(provider());
  const settlementTime = commitmentTime + delay + 1;
  await fastForwardTo(settlementTime, provider());

  const settleTx = await settleOrder({
    systems,
    keeper,
    marketId,
    accountId,
    offChainPrice: price,
    settlementTime,
    feedId: strategy.feedId,
  });

  return { commitTx, settleTx };
};
