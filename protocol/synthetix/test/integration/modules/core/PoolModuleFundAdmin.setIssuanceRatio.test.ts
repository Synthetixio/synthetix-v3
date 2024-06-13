import assert from 'node:assert';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';
import { bn, bootstrapWithMockMarketAndPool } from '../../bootstrap';

describe('PoolModule Admin set pool collateral issuance ratio', function () {
  const { signers, systems, collateralAddress, restore } = bootstrapWithMockMarketAndPool();

  let owner: ethers.Signer, user1: ethers.Signer, user2: ethers.Signer;

  const thirdPoolId = 3384633;

  before('identify signers', async () => {
    [owner, user1, user2] = signers();
  });

  before(restore);

  before('give user1 permission to create pool', async () => {
    await systems()
      .Core.connect(owner)
      .addToFeatureFlagAllowlist(
        ethers.utils.formatBytes32String('createPool'),
        await user1.getAddress()
      );
  });

  before('create a pool', async () => {
    await (
      await systems()
        .Core.connect(user1)
        .createPool(thirdPoolId, await user1.getAddress())
    ).wait();
  });

  it('only works for owner', async () => {
    await assertRevert(
      systems()
        .Core.connect(user2)
        .setPoolCollateralConfiguration(thirdPoolId, collateralAddress(), {
          collateralLimitD18: bn(10),
          issuanceRatioD18: bn(2),
        }),
      `Unauthorized("${await user2.getAddress()}")`,
      systems().Core
    );
  });

  it('min collateral ratio is set to zero for the pool by default', async () => {
    assert.equal(
      await systems().Core.getPoolCollateralIssuanceRatio(thirdPoolId, collateralAddress()),
      0
    );
  });

  it('set the pool collateal issuance ratio to 200%', async () => {
    await systems()
      .Core.connect(user1)
      .setPoolCollateralConfiguration(thirdPoolId, collateralAddress(), {
        collateralLimitD18: bn(10),
        issuanceRatioD18: bn(2),
      });

    assertBn.equal(
      await systems().Core.getPoolCollateralIssuanceRatio(thirdPoolId, collateralAddress()),
      bn(2)
    );
  });

  it('can get pool collateral configuration', async () => {
    await systems()
      .Core.connect(user1)
      .setPoolCollateralConfiguration(thirdPoolId, collateralAddress(), {
        collateralLimitD18: bn(123),
        issuanceRatioD18: bn(345),
      });

    const { collateralLimitD18, issuanceRatioD18 } =
      await systems().Core.getPoolCollateralConfiguration(thirdPoolId, collateralAddress());
    assert.deepEqual(
      { collateralLimitD18, issuanceRatioD18 },
      { collateralLimitD18: bn(123), issuanceRatioD18: bn(345) }
    );
  });
});
