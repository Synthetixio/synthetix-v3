import { ethers } from 'ethers';
import { Systems } from '../bootstrap';
import { getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';

const ASYNC_OFFCHAIN_ORDER_TYPE = 1;

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
  settlementDelay: () => number;
  settlementWindowDuration: () => number;
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

  it('emit commit order event', async () => {
    await assertEvent(
      tx,
      `OrderCommitted(${data.marketId()}, ${data.accountId()}, ${ASYNC_OFFCHAIN_ORDER_TYPE}, ${data.sizeDelta()}, ${data.acceptablePrice()}, ${
        startTime + data.settlementDelay()
      }, ${startTime + data.settlementDelay() + data.settlementWindowDuration()}, "${
        ethers.constants.HashZero
      }", "${await data.trader().getAddress()}"`,
      chainState.systems().PerpsMarket
    );
  });

  return {
    startTime: () => startTime,
    initialCollateral: () => initialCollateral,
    totalCollateral: () => totalCollateral,
    commitTx: () => tx,
  };
};
