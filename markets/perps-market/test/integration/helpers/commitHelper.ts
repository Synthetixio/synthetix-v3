import { ethers } from 'ethers';
import { Systems } from '../bootstrap';
import { getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';

type IncomingChainState = {
  systems: () => Systems;
  provider: () => ethers.providers.JsonRpcProvider;
};

export type CommitOrderData = {
  trader: () => ethers.Signer;
  marketId: () => ethers.BigNumber;
  accountId: () => number;
  minCollateral: () => ethers.BigNumber;
  sizeDelta: () => ethers.BigNumber;
  settlementStrategyId: () => number;
  acceptablePrice: () => ethers.BigNumber;
  trackingCode: string;
};

type CommitOrderReturn = {
  startTime: () => number;
  initialCollateral: () => ethers.BigNumber;
  totalCollateral: () => ethers.BigNumber;
  commitTx: () => ethers.ContractTransaction;
};

type CommitOrderType = (data: CommitOrderData, chainState: IncomingChainState) => CommitOrderReturn;

export const commitOrder: CommitOrderType = (data, chainState) => {
  let tx: ethers.ContractTransaction;
  let startTime: number;
  let initialCollateral: ethers.BigNumber;
  let totalCollateral: ethers.BigNumber;

  before('ensure minimum collateral', async () => {
    initialCollateral = await chainState
      .systems()
      .PerpsMarket.totalCollateralValue(data.accountId());

    if (initialCollateral.lt(data.minCollateral())) {
      await chainState
        .systems()
        .PerpsMarket.connect(data.trader())
        .modifyCollateral(data.accountId(), 0, data.minCollateral().sub(initialCollateral));
    }

    totalCollateral = await chainState.systems().PerpsMarket.totalCollateralValue(data.accountId());
  });

  before('commit the order', async () => {
    tx = await chainState.systems().PerpsMarket.connect(data.trader()).commitOrder({
      marketId: data.marketId(),
      accountId: data.accountId(),
      sizeDelta: data.sizeDelta(),
      settlementStrategyId: data.settlementStrategyId(),
      acceptablePrice: data.acceptablePrice(),
      trackingCode: data.trackingCode,
    });
    startTime = await getTime(chainState.provider());
  });

  return {
    startTime: () => startTime,
    initialCollateral: () => initialCollateral,
    totalCollateral: () => totalCollateral,
    commitTx: () => tx,
  };
};
