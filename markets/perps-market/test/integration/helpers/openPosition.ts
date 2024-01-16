import { ethers } from 'ethers';
import { Systems } from '../bootstrap';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { settleOrder } from '.';
import { getTxTime } from '@synthetixio/core-utils/src/utils/hardhat/rpc';

export type OpenPositionData = {
  trader: ethers.Signer;
  marketId: ethers.BigNumber;
  accountId: number;
  sizeDelta: ethers.BigNumber;
  settlementStrategyId: ethers.BigNumber;
  price: ethers.BigNumber;
  trackingCode?: string;
  keeper: ethers.Signer;
  referrer?: string;
  skipSettingPrice?: boolean;
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
    referrer,
    trackingCode,
    keeper,
    skipSettingPrice,
  } = data;

  const strategy = await systems().PerpsMarket.getSettlementStrategy(
    data.marketId,
    data.settlementStrategyId
  );
  const delay = strategy.settlementDelay.toNumber();

  const commitTx = await systems()
    .PerpsMarket.connect(trader)
    .commitOrder({
      marketId,
      accountId,
      sizeDelta,
      settlementStrategyId,
      acceptablePrice: sizeDelta.gt(0) ? price.mul(2) : price.div(2),
      referrer: referrer || ethers.constants.AddressZero,
      trackingCode: trackingCode ?? ethers.constants.HashZero,
    });

  const commitmentTime = await getTxTime(provider(), commitTx);
  const settlementTime = commitmentTime + delay + 1;
  await fastForwardTo(settlementTime, provider());

  const settleTx = await settleOrder({
    systems,
    keeper,
    accountId,
    offChainPrice: price,
    skipSettingPrice,
  });
  const settleTime = await getTxTime(provider(), settleTx);

  return { settleTime, settleTx, commitmentTime };
};
