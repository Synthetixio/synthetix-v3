import { ethers } from 'ethers';
import { Systems } from '../bootstrap';

export type CommitOrderData = {
  systems: () => Systems;
  trader: ethers.Signer;
  marketId: ethers.BigNumber;
  accountId: number;
  sizeDelta: ethers.BigNumber;
  settlementStrategyId: number;
  acceptablePrice: ethers.BigNumber;
  trackingCode?: string;
};
type CommitOrderType = (data: CommitOrderData) => Promise<ethers.ContractTransaction>;

export const commitOrder: CommitOrderType = async (data) => {
  const {
    systems,
    marketId,
    accountId,
    sizeDelta,
    settlementStrategyId,
    acceptablePrice,
    trackingCode,
  } = data;

  const commitTx = await systems()
    .PerpsMarket.connect(data.trader)
    .commitOrder({
      marketId,
      accountId,
      sizeDelta,
      settlementStrategyId,
      acceptablePrice,
      trackingCode: trackingCode ?? ethers.constants.HashZero,
    });
  await commitTx.wait(); // force immediate confirmation to prevent flaky tests due to block timestamp

  return commitTx;
};
