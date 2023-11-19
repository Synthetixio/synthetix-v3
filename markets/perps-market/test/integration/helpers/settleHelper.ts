import { ethers } from 'ethers';
import { Systems } from '../bootstrap';

export type SettleOrderData = {
  systems: () => Systems;
  keeper: ethers.Signer;
  accountId: number;
  offChainPrice: ethers.BigNumberish;
  commitmentTime: number;
};

export const settleOrder = async ({
  systems,
  keeper,
  accountId,
  offChainPrice,
  commitmentTime,
}: SettleOrderData): Promise<ethers.ContractTransaction> => {
  // set Pyth setBenchmarkPrice
  await systems().MockPythERC7412Wrapper.setBenchmarkPrice(commitmentTime, offChainPrice);

  // settle
  const tx = await systems().PerpsMarket.connect(keeper).settleOrder(accountId);
  return tx;
};
