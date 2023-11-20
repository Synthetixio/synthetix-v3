import { ethers } from 'ethers';
import { Systems } from '../bootstrap';

export type SettleOrderData = {
  systems: () => Systems;
  keeper: ethers.Signer;
  accountId: number;
  offChainPrice: ethers.BigNumberish;
  skipSettingPrice?: boolean;
};

export const settleOrder = async ({
  systems,
  keeper,
  accountId,
  offChainPrice,
  skipSettingPrice,
}: SettleOrderData): Promise<ethers.ContractTransaction> => {
  // set Pyth setBenchmarkPrice
  if (!skipSettingPrice) {
    await systems().MockPythERC7412Wrapper.setBenchmarkPrice(offChainPrice);
  }
  // settle
  const tx = await systems().PerpsMarket.connect(keeper).settleOrder(accountId);
  return tx;
};
