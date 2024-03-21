import { BigNumber, ethers } from 'ethers';
import hre from 'hardhat';
import { CoreProxy } from '@synthetixio/main/test/generated/typechain';
import { PerpsMarketProxy } from '../../generated/typechain';

export const createRewardsDistributor = async (
  owner: ethers.Signer,
  Core: CoreProxy,
  PerpsMarket: PerpsMarketProxy,
  poolId: number,
  collateralAddress: string,
  payoutToken: string,
  payoutTokenDecimals: number,
  marketId: BigNumber
) => {
  const factory = await hre.ethers.getContractFactory('MockRewardsDistributorExternal');
  const rewardsDistributor = await factory
    .connect(owner)
    .deploy(
      Core.address,
      poolId,
      collateralAddress,
      payoutToken,
      payoutTokenDecimals,
      `Distributor for ${marketId}`,
      PerpsMarket.address
    );

  const distributorAddress = rewardsDistributor.address;

  // Register distributor for collateral in core
  await Core.connect(owner).registerRewardsDistributor(
    poolId,
    collateralAddress,
    distributorAddress
  );

  return distributorAddress;
};
