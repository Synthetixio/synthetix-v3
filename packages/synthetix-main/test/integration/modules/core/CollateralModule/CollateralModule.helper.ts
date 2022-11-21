import { ethers } from 'hardhat';
import { ethers as Ethers } from 'ethers';
import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import NodeTypes from '@synthetixio/oracle-manager/test/integration/mixins/Node.types';

export async function addCollateral(
  tokenName: string,
  tokenSymbol: string,
  targetCRatio: number,
  minimumCRatio: number,
  owner: Ethers.Signer,
  core: Ethers.Contract,
  oracleManager: Ethers.Contract
) {
  let factory;

  factory = await ethers.getContractFactory('CollateralMock');
  const Collateral = await factory.connect(owner).deploy();

  await (await Collateral.connect(owner).initialize(tokenName, tokenSymbol, 18)).wait();

  factory = await ethers.getContractFactory('AggregatorV3Mock');
  const aggregator = await factory.connect(owner).deploy();

  await (await aggregator.connect(owner).mockSetCurrentPrice(1)).wait();

  const params1 = ethers.utils.defaultAbiCoder.encode(['address'], [aggregator.address]);
  await oracleManager.connect(owner).registerNode([], NodeTypes.CHAINLINK, params1);
  const oracleNodeId = await oracleManager
    .connect(owner)
    .getNodeId([], NodeTypes.CHAINLINK, params1);

  await (
    await core
      .connect(owner)
      .configureCollateral(Collateral.address, oracleNodeId, targetCRatio, minimumCRatio, 0, true)
  ).wait();

  return { Collateral, CollateralPriceFeed: aggregator, oracleNodeId };
}

export async function verifyCollateral(
  collateralIdx: number,
  Collateral: Ethers.Contract,
  oracleNodeId: string,
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
  assert.equal(collateralType.oracleNodeId, oracleNodeId);
  assertBn.equal(collateralType.targetCRatio, expectedCRatio);
  assertBn.equal(collateralType.minimumCRatio, expectedMinimumCRatio);
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
