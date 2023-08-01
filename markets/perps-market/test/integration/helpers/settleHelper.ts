import { ethers } from 'ethers';
import { Systems } from '../bootstrap';

export type SettleOrderData = {
  systems: () => Systems;
  keeper: ethers.Signer;
  accountId: number;
  offChainPrice: ethers.BigNumberish;
  settlementTime: number;
  feedId: string;
};

export const settleOrder = async ({
  systems,
  keeper,
  accountId,
  offChainPrice,
  settlementTime,
  feedId,
}: SettleOrderData): Promise<ethers.ContractTransaction> => {
  // create extraData based on market/account id
  const extraData = ethers.utils.defaultAbiCoder.encode(['uint128'], [accountId]);

  // build pyth data
  const pythPriceExpotential = 6;
  const pythPrice = ethers.BigNumber.from(offChainPrice).mul(10 ** pythPriceExpotential);
  // Get the latest price
  const pythPriceData = await systems().MockPyth.createPriceFeedUpdateData(
    feedId,
    pythPrice, // price
    1, // confidence
    -pythPriceExpotential,
    pythPrice, // emaPrice
    1, // emaConfidence
    settlementTime
  );
  const updateFee = await systems().MockPyth.getUpdateFee([pythPriceData]);

  // settle
  const tx = await systems()
    .PerpsMarket.connect(keeper)
    .settlePythOrder(pythPriceData, extraData, { value: updateFee });

  return tx;
};
