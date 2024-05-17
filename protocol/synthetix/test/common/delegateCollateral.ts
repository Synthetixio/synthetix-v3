import type { CoreProxy } from '../generated/typechain';
import { BigNumber, ethers, Contract } from 'ethers';

type SystemArgs = {
  Core: CoreProxy | Contract;
};

export async function expectedToDeltaDelegatedCollateral(
  systems: () => SystemArgs,
  accountId: number,
  poolId: number,
  collateralAddress: string,
  fixedDepositAmount: BigNumber
): Promise<BigNumber> {
  const currentPositionCollateral = await systems().Core.getPositionCollateral(
    accountId,
    poolId,
    collateralAddress
  );
  const deltaCollateral = fixedDepositAmount.sub(currentPositionCollateral);
  return deltaCollateral;
}

export async function declareDelegateIntent(
  systems: () => SystemArgs,
  owner: ethers.Signer,
  signer: ethers.Signer,
  accountId: number,
  poolId: number,
  collateralAddress: string,
  fixedDepositAmount: BigNumber,
  leverage: BigNumber,
  shouldCleanBefore: boolean = true
): Promise<BigNumber> {
  if (shouldCleanBefore) {
    await systems().Core.connect(owner).forceDeleteAllAccountIntents(accountId);
  }
  const intentId = await systems()
    .Core.connect(signer)
    .callStatic.declareIntentToDelegateCollateral(
      accountId,
      poolId,
      collateralAddress,
      await expectedToDeltaDelegatedCollateral(
        systems,
        accountId,
        poolId,
        collateralAddress,
        fixedDepositAmount
      ),
      leverage
    );
  await systems()
    .Core.connect(signer)
    .declareIntentToDelegateCollateral(
      accountId,
      poolId,
      collateralAddress,
      await expectedToDeltaDelegatedCollateral(
        systems,
        accountId,
        poolId,
        collateralAddress,
        fixedDepositAmount
      ),
      leverage
    );
  return intentId;
}

export async function delegateCollateral(
  systems: () => SystemArgs,
  owner: ethers.Signer,
  signer: ethers.Signer,
  accountId: number,
  poolId: number,
  collateralAddress: string,
  fixedDepositAmount: BigNumber,
  leverage: BigNumber,
  shouldCleanBefore: boolean = true
): Promise<void> {
  const intentId = await declareDelegateIntent(
    systems,
    owner,
    signer,
    accountId,
    poolId,
    collateralAddress,
    fixedDepositAmount,
    leverage,
    shouldCleanBefore
  );
  await systems()
    .Core.connect(signer)
    .processIntentToDelegateCollateralByIntents(accountId, [intentId]);
}
