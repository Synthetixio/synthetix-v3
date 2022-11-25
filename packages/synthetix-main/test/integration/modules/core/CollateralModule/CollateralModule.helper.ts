import { ethers } from 'hardhat';
import { ethers as Ethers } from 'ethers';
import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';

export async function addCollateral(
  tokenName: string,
  tokenSymbol: string,
  issuanceRatio: number,
  liquidationRatio: number,
  owner: Ethers.Signer,
  core: Ethers.Contract
) {
  let factory;

  factory = await ethers.getContractFactory('CollateralMock');
  const Collateral = await factory.connect(owner).deploy();

  await (await Collateral.connect(owner).initialize(tokenName, tokenSymbol, 18)).wait();

  factory = await ethers.getContractFactory('AggregatorV3Mock');
  const CollateralPriceFeed = await factory.connect(owner).deploy();

  await (await CollateralPriceFeed.connect(owner).mockSetCurrentPrice(1)).wait();

  await (
    await core.connect(owner).configureCollateral({
      tokenAddress: Collateral.address,
      priceFeed: CollateralPriceFeed.address,
      issuanceRatio: issuanceRatio,
      liquidationRatio: liquidationRatio,
      liquidationReward: 0,
      minDelegation: 0,
      depositingEnabled: true,
    })
  ).wait();

  return { Collateral, CollateralPriceFeed };
}

export async function verifyCollateral(
  collateralIdx: number,
  Collateral: Ethers.Contract,
  CollateralPriceFeed: Ethers.Contract,
  expectedCRatio: number,
  expectedMinimumCRatio: number,
  expectedToBeEnabled: boolean,
  core: Ethers.Contract
) {
  assert.equal(
    (await core.getCollateralConfigurations(false))[collateralIdx].tokenAddress,
    Collateral.address
  );

  const collateralType = await core.getCollateralConfiguration(Collateral.address);

  assert.equal(collateralType.tokenAddress, Collateral.address);
  assert.equal(collateralType.priceFeed, CollateralPriceFeed.address);
  assertBn.equal(collateralType.issuanceRatio, expectedCRatio);
  assertBn.equal(collateralType.liquidationRatio, expectedMinimumCRatio);
  assert.equal(collateralType.depositingEnabled, expectedToBeEnabled);
}

export async function verifyCollateralListed(
  Collateral: Ethers.Contract,
  listed: boolean,
  hideDisabled: boolean,
  core: Ethers.Contract
) {
  const collaterals = await core.getCollateralConfigurations(hideDisabled);

  assert.equal(
    collaterals.some((v: { tokenAddress: string }) => v.tokenAddress === Collateral.address),
    listed
  );
}
