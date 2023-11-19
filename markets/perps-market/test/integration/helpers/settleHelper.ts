import { ethers } from 'ethers';
import { Systems } from '../bootstrap';
import { wei } from '@synthetixio/wei';

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
  const pythPriceExpotential = 8;

  const pythPrice = wei(offChainPrice, pythPriceExpotential).toBN(); //ethers.BigNumber.from(offChainPrice).mul(10 ** pythPriceExpotential);

  // set Pyth setBenchmarkPrice
  await systems().MockPythERC7412Wrapper.setBenchmarkPrice(commitmentTime, pythPrice);

  // settle
  const tx = await systems().PerpsMarket.connect(keeper).settleOrder(accountId);
  return tx;
};
