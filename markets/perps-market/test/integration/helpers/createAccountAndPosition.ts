import { ethers } from 'ethers';
import { OpenPositionData, openPosition } from '.';

export const createAccountAndOpenPosition = async (
  data: OpenPositionData & { collateral: ethers.BigNumber }
) => {
  await data.systems().PerpsMarket.connect(data.trader)['createAccount(uint128)'](data.accountId);
  await data
    .systems()
    .PerpsMarket.connect(data.trader)
    .modifyCollateral(data.accountId, 0, data.collateral);
  await openPosition(data);
};
