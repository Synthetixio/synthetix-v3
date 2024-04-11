import { ethers } from 'ethers';
import type { CoreProxy, CollateralMock } from '../generated/typechain';

type SystemArgs = {
  Core: CoreProxy;
  CollateralMock: CollateralMock;
};

export const depositAmount = ethers.utils.parseEther('1000');

export function bootstrapStakers(
  systems: () => SystemArgs,
  signers: () => ethers.Signer[],
  delegateAmount: ethers.BigNumber = depositAmount
) {
  let staker1: ethers.Signer, staker2: ethers.Signer, staker3: ethers.Signer;
  before('identify stakers', () => {
    [, , , staker1, staker2, staker3] = signers();
  });
  // create new pool
  before('create separate pool', async () => {
    const [owner] = signers();
    await systems()
      .Core.connect(owner)
      .createPool(2, await owner.getAddress());
  });

  before('create traders', async () => {
    await stake(systems(), 2, 1000, staker1, delegateAmount);
    await stake(systems(), 2, 1001, staker2, delegateAmount);
    await stake(systems(), 2, 1002, staker3, delegateAmount);
  });

  before('mint usd', async () => {
    const collateralAddress = systems().CollateralMock.address;
    await systems()
      .Core.connect(staker1)
      .mintUsd(1000, 2, collateralAddress, delegateAmount.mul(200));
    await systems()
      .Core.connect(staker1)
      .withdraw(1000, await systems().Core.getUsdToken(), delegateAmount.mul(200));
    await systems()
      .Core.connect(staker2)
      .mintUsd(1001, 2, collateralAddress, delegateAmount.mul(200));
    await systems()
      .Core.connect(staker2)
      .withdraw(1001, await systems().Core.getUsdToken(), delegateAmount.mul(200));
    await systems()
      .Core.connect(staker3)
      .mintUsd(1002, 2, collateralAddress, delegateAmount.mul(200));
    await systems()
      .Core.connect(staker3)
      .withdraw(1002, await systems().Core.getUsdToken(), delegateAmount.mul(200));
  });
}

export const stake = async (
  systems: SystemArgs,
  poolId: number,
  accountId: number,
  user: ethers.Signer,
  delegateAmount: ethers.BigNumber = depositAmount
) => {
  const { Core, CollateralMock } = systems;
  await CollateralMock.mint(await user.getAddress(), delegateAmount.mul(1000));

  // create user account
  await Core.connect(user)['createAccount(uint128)'](accountId);

  // approve
  await CollateralMock.connect(user).approve(Core.address, delegateAmount.mul(300));

  // stake collateral
  await Core.connect(user).deposit(accountId, CollateralMock.address, delegateAmount.mul(300));

  // invest in the pool
  await Core.connect(user).delegateCollateral(
    accountId,
    poolId,
    CollateralMock.address,
    delegateAmount,
    ethers.utils.parseEther('1')
  );

  // also for convenience invest in the 0 pool
  await Core.connect(user).delegateCollateral(
    accountId,
    0,
    CollateralMock.address,
    delegateAmount,
    ethers.utils.parseEther('1')
  );
};
