import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';
import { bootstrapWithMockMarketAndPool } from '../../bootstrap';

describe('PoolModule Admin setMinLiquidityRatio(uint256)', function () {
  const { signers, systems, restore } = bootstrapWithMockMarketAndPool();

  let owner: ethers.Signer, user1: ethers.Signer;

  before('identify signers', async () => {
    [owner, user1] = signers();
  });

  before(restore);

  it('only works for owner', async () => {
    await assertRevert(
      systems().Core.connect(user1)['setMinLiquidityRatio(uint256)'](ethers.utils.parseEther('2')),
      `Unauthorized("${await user1.getAddress()}")`,
      systems().Core
    );
  });

  it('is set when invoked successfully', async () => {
    const value = ethers.utils.parseEther('2');
    await systems().Core.connect(owner)['setMinLiquidityRatio(uint256)'](value);
    assertBn.equal(await systems().Core['getMinLiquidityRatio()'](), value);
  });
});
