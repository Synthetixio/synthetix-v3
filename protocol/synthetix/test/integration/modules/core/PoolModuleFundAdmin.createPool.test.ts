import assert from 'node:assert';
import { ethers } from 'ethers';
import { bootstrapWithMockMarketAndPool } from '../../bootstrap';

describe('PoolModule Admin createPool()', function () {
  const { signers, systems, restore } = bootstrapWithMockMarketAndPool();

  let owner: ethers.Signer, user1: ethers.Signer;

  const secondPoolId = 3384692;

  before('identify signers', async () => {
    [owner, user1] = signers();
  });

  before(restore);

  it('fails when pool already exists', async () => {});

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
        .createPool(secondPoolId, await user1.getAddress())
    ).wait();
  });

  it('pool is created', async () => {
    assert.equal(await systems().Core.getPoolOwner(secondPoolId), await user1.getAddress());
  });
});
