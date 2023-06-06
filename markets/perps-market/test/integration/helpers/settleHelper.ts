import { ethers } from 'ethers';
import { Systems } from '../bootstrap';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';

type IncomingChainState = {
  systems: () => Systems;
  provider: () => ethers.providers.JsonRpcProvider;
};

export type SettleOrderData = {
  keeper: () => ethers.Signer;
  marketId: () => ethers.BigNumber;
  accountId: () => number;
  feedId: () => string;
  startTime: () => number;
  settlementDelay: () => number;
  offChainPrice: () => ethers.BigNumberish;
};

type SettleOrderReturn = {
  settleTx: () => ethers.ContractTransaction;
};

type SettleOrderType = (data: SettleOrderData, chainState: IncomingChainState) => SettleOrderReturn;

export const settleOrder: SettleOrderType = (data, chainState) => {
  let tx: ethers.ContractTransaction;
  let updateFee: ethers.BigNumber;

  let pythPriceData: string, extraData: string;

  before('fast forward to settlement time', async () => {
    // fast forward to settlement
    await fastForwardTo(data.startTime() + data.settlementDelay() + 1, chainState.provider());
  });

  before('setup bytes data', () => {
    extraData = ethers.utils.defaultAbiCoder.encode(
      ['uint128', 'uint128'],
      [data.marketId(), data.accountId()]
    );
    // const pythCallData = ethers.utils.solidityPack(
    //   ['bytes32', 'uint64'],
    //   [data.feedId(), data.startTime() + data.settlementDelay()]
    // );
  });

  before('prepare data', async () => {
    const pythPriceExpotential = 6;
    const pythPrice = ethers.BigNumber.from(data.offChainPrice()).mul(10 ** pythPriceExpotential);
    // Get the latest price
    pythPriceData = await chainState.systems().MockPyth.createPriceFeedUpdateData(
      data.feedId(),
      pythPrice, // price
      1, // confidence
      -pythPriceExpotential,
      pythPrice, // emaPrice
      1, // emaConfidence
      data.startTime() + data.settlementDelay() + 1
    );
    updateFee = await chainState.systems().MockPyth.getUpdateFee([pythPriceData]);
  });

  before('settle', async () => {
    // Using the pyth order directly without getting the data from revert
    tx = await chainState
      .systems()
      .PerpsMarket.connect(data.keeper())
      .settlePythOrder(pythPriceData, extraData, { value: updateFee });
  });

  return {
    settleTx: () => tx,
  };
};
