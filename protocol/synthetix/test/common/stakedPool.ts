import { ethers } from 'ethers';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { wei } from '@synthetixio/wei';
import { stake } from './stakers';
import { createOracleNode } from '@synthetixio/oracle-manager/test/common';
import { bootstrap } from '../integration/bootstrap';

export const bn = (n: number) => wei(n).toBN();

const POOL_FEATURE_FLAG = ethers.utils.formatBytes32String('createPool');

export const createStakedPool = (
  r: ReturnType<typeof bootstrap>,
  stakedCollateralPrice: ethers.BigNumber = bn(1),
  stakedAmount: ethers.BigNumber = bn(1000)
) => {
  let aggregator: ethers.Contract;

  let oracleNodeId: string;
  const accountId = 1;
  const poolId = 1;

  before('give owner permission to create pools', async () => {
    await r
      .systems()
      .Core.addToFeatureFlagAllowlist(POOL_FEATURE_FLAG, await r.owner().getAddress());
  });

  before('setup oracle manager node', async () => {
    const results = await createOracleNode(
      r.signers()[0],
      stakedCollateralPrice,
      r.systems().OracleManager
    );
    oracleNodeId = results.oracleNodeId;
    aggregator = results.aggregator;
  });

  before('configure collateral', async () => {
    // add collateral
    await r.systems().Core.connect(r.owner()).configureCollateral({
      tokenAddress: r.systems().CollateralMock.address,
      oracleNodeId,
      issuanceRatioD18: '5000000000000000000',
      liquidationRatioD18: '1500000000000000000',
      liquidationRewardD18: '20000000000000000000',
      minDelegationD18: '20000000000000000000',
      depositingEnabled: true,
    });
  });

  before('create pool', async () => {
    // create pool
    await r
      .systems()
      .Core.connect(r.owner())
      .createPool(poolId, await r.owner().getAddress());
  });

  before('stake', async () => {
    const [, staker] = r.signers();
    await stake(
      { Core: r.systems().Core, CollateralMock: r.systems().CollateralMock },
      poolId,
      accountId,
      staker,
      stakedAmount
    );
  });

  const restore = snapshotCheckpoint(r.provider);

  return {
    ...r,
    aggregator: () => aggregator,
    accountId,
    poolId,
    collateralContract: () => r.systems().CollateralMock,
    collateralAddress: () => r.systems().CollateralMock.address,
    depositAmount: stakedAmount,
    restore,
    staker: () => r.signers()[1],
    oracleNodeId: () => oracleNodeId,
  };
};
