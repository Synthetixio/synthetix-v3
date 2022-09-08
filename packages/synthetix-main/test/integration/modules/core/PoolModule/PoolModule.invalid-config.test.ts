import { bootstrapWithMockMarketAndPool } from '../../../bootstrap';
import { ethers } from 'ethers';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';

describe('PoolModule', function () {
  const { signers, systems, poolId } = bootstrapWithMockMarketAndPool();

  let owner: ethers.Signer, user1: ethers.Signer, user2: ethers.Signer;

  describe('PoolModule - Pool administration', function () {
    before('identify signers', async () => {
      [owner, user1, user2] = signers();
    });

    describe('when an attempt is made to configure a pool that does not exist', function () {
      it('reverts', async () => {
        await assertRevert(
          systems().Core.connect(user1).setPoolConfiguration(834693286, [1], [1], [0, 0]),
          `PoolNotFound("${834693286}")`,
          systems().Core
        );
      });
    });

    describe('when a user attempts to manage a pool owned by another user', function () {
      it('reverts', async () => {
        await assertRevert(
          systems().Core.connect(user2).setPoolConfiguration(poolId, [1], [1], [0, 0]),
          `Unauthorized("${await user2.getAddress()}")`,
          systems().Core
        );
      });
    });

    describe('when the pool owner incorrectly manages a pool', function () {
      describe('by specifying more weights than markets', function () {
        it('reverts', async () => {
          await assertRevert(
            systems().Core.connect(owner).setPoolConfiguration(poolId, [1], [1, 2], [0, 0]),
            'InvalidParameters("markets.length,weights.length,maxDebtShareValues.length", "must match")',
            systems().Core
          );
        });
      });

      describe('by specifying more markets than weights', function () {
        it('reverts', async () => {
          await assertRevert(
            systems().Core.connect(owner).setPoolConfiguration(poolId, [1, 2], [1], [0, 0]),
            'InvalidParameters("markets.length,weights.length,maxDebtShareValues.length", "must match")',
            systems().Core
          );
        });
      });

      describe('by specifying a market that is not registered', function () {
        it('reverts', async () => {
          await assertRevert(
            systems()
              .Core.connect(owner)
              .setPoolConfiguration(poolId, [1, 92197628], [1, 1], [0, 0]),
            'MarketNotFound("92197628")',
            systems().Core
          );
        });
      });

      describe('by specifying duplicate markets', function () {
        it('reverts', async () => {
          await assertRevert(
            systems().Core.connect(owner).setPoolConfiguration(poolId, [1, 1], [1, 1], [0, 0]),
            'InvalidParameters("markets"',
            systems().Core
          );
        });
      });
    });
  });
});
