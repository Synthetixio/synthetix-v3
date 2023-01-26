import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import hre from 'hardhat';
import { ethers } from 'ethers';
import { fastForwardTo, getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';

import Permissions from '../../mixins/AccountRBACMixin.permissions';
import { bootstrapWithStakedPool } from '../../bootstrap';
import { snapshotCheckpoint } from '../../../utils/snapshot';

// ---------------------------------------
// If the tests are failing Make sure you run foundryup to update the anvil to latest version
// ---------------------------------------

describe('RewardsManagerModule', function () {
  const { provider, signers, systems, poolId, collateralAddress, accountId } =
    bootstrapWithStakedPool();

  let owner: ethers.Signer, user1: ethers.Signer, user2: ethers.Signer;

  let Collateral, RewardDistributor;

  const rewardAmount = ethers.utils.parseEther('1000');

  let startTime: number;

  before('identify signers', async () => {
    [owner, user1, user2] = signers();
  });

  before('deploy fake reward token', async () => {
    const factory = await hre.ethers.getContractFactory('CollateralMock');
    Collateral = await factory.connect(owner).deploy();

    await (await Collateral.connect(owner).initialize('Fake Reward', 'FAKE', 6)).wait();
  });

  before('deploy fake reward distributor', async () => {
    const factory = await hre.ethers.getContractFactory('RewardDistributorMock');
    RewardDistributor = await factory.connect(owner).deploy();

    await RewardDistributor.connect(owner).initialize(
      systems().Core.address,
      Collateral.address,
      'Fake Reward Distributor'
    );
  });

  before('mint token for the reward distributor', async () => {
    await Collateral.mint(RewardDistributor.address, rewardAmount.mul(1000));
  });

  before(async () => {
    //register reward distribution
    await systems()
      .Core.connect(owner)
      .registerRewardsDistributor(poolId, collateralAddress(), RewardDistributor.address);
  });

  const restore = snapshotCheckpoint(provider);

  describe('registerRewardsDistributor()', () => {
    before(restore);

    it('only works with owner', async () => {
      await assertRevert(
        systems()
          .Core.connect(user1)
          .registerRewardsDistributor(poolId, collateralAddress(), RewardDistributor.address),
        `Unauthorized("${await user1.getAddress()}")`,
        systems().Core
      );
    });

    it('reverts with invalid reward distributor (does not support IRewardDistributor interface)', async () => {
      await assertRevert(
        systems()
          .Core.connect(owner)
          .registerRewardsDistributor(poolId, collateralAddress(), await owner.getAddress()),
        'InvalidParameter("distributor", "invalid interface")'
      );
    });

    describe('distributeRewards', () => {
      describe('only rewards distributor can call distributeRewards', () => {
        before(restore);

        it('system distributeRewards reverts if is called from other than the distributor', async () => {
          await assertRevert(
            systems().Core.connect(owner).distributeRewards(
              poolId,
              collateralAddress(),
              rewardAmount,
              0, // timestamp
              0
            ),
            'InvalidParameter("poolId-collateralType-distributor", "reward is not registered")'
          );
        });

        it('reward is not distributed', async () => {
          const [rewards] = await systems().Core.callStatic.updateRewards(
            poolId,
            collateralAddress(),
            accountId
          );
          assertBn.equal(rewards[0], 0);
        });
      });

      describe('instantaneous', () => {
        describe('in the past', () => {
          before(restore);
          before(async () => {
            startTime = await getTime(provider());

            // distribute rewards multiple times to see what happens
            // if many distributions happen in the past
            await RewardDistributor.connect(owner).distributeRewards(
              poolId,
              collateralAddress(),
              rewardAmount,
              0, // timestamp
              0
            );

            startTime = await getTime(provider());

            await RewardDistributor.connect(owner).distributeRewards(
              poolId,
              collateralAddress(),
              rewardAmount,
              1, // timestamp
              0
            );

            startTime = await getTime(provider());

            await RewardDistributor.connect(owner).distributeRewards(
              poolId,
              collateralAddress(),
              rewardAmount,
              1, // timestamp
              0
            );

            // one distribution in the future to ensure switching
            // from past to future works as expected
            await RewardDistributor.connect(owner).distributeRewards(
              poolId,
              collateralAddress(),
              rewardAmount,
              startTime + 10000000, // timestamp
              0
            );
          });

          it('is distributed', async () => {
            const [rewards] = await systems().Core.callStatic.updateRewards(
              poolId,
              collateralAddress(),
              accountId
            );
            // should have received all 3 past rewards
            assertBn.equal(rewards[0], rewardAmount.mul(3));
          });
        });

        describe('in the future', () => {
          before(restore);
          before(async () => {
            startTime = await getTime(provider());

            await RewardDistributor.connect(owner).distributeRewards(
              poolId,
              collateralAddress(),
              rewardAmount,
              startTime + 10, // timestamp
              0
            );

            startTime = await getTime(provider());

            // distribute one in the past to ensure switching from past to future works
            await RewardDistributor.connect(owner).distributeRewards(
              poolId,
              collateralAddress(),
              rewardAmount,
              startTime - 10, // timestamp
              0
            );

            await RewardDistributor.connect(owner).distributeRewards(
              poolId,
              collateralAddress(),
              rewardAmount,
              startTime + 30, // timestamp
              0
            );
          });

          it('is not distributed future yet', async () => {
            const [rewards] = await systems().Core.callStatic.updateRewards(
              poolId,
              collateralAddress(),
              accountId
            );

            // only one reward should have been distributed
            assertBn.equal(rewards[0], rewardAmount);
          });

          it('has no rate', async () => {
            const rate = await systems().Core.getRewardRate(
              poolId,
              collateralAddress(),
              RewardDistributor.address
            );

            assertBn.equal(rate, 0);
          });

          describe('after time passes', () => {
            before(async () => {
              await fastForwardTo(startTime + 30, provider());
            });

            it('is distributed', async () => {
              // should have received 2 distributions
              const [rewards] = await systems().Core.callStatic.updateRewards(
                poolId,
                collateralAddress(),
                accountId
              );
              assertBn.equal(rewards[0], rewardAmount.mul(2));
            });

            it('has no rate', async () => {
              const rate = await systems().Core.getRewardRate(
                poolId,
                collateralAddress(),
                RewardDistributor.address
              );

              assertBn.equal(rate, 0);
            });
          });
        });
      });

      describe('over time', () => {
        describe('in the past', () => {
          before(restore);
          before(async () => {
            await RewardDistributor.connect(owner).distributeRewards(
              poolId,
              collateralAddress(),
              rewardAmount,
              startTime - 100, // timestamp
              100
            );

            await RewardDistributor.connect(owner).distributeRewards(
              poolId,
              collateralAddress(),
              rewardAmount,
              startTime - 50, // timestamp
              50
            );

            // add one after to test behavior of future distribution
            await RewardDistributor.connect(owner).distributeRewards(
              poolId,
              collateralAddress(),
              rewardAmount,
              startTime + 50, // timestamp
              50
            );
          });

          it('is fully distributed', async () => {
            const [rewards] = await systems().Core.callStatic.updateRewards(
              poolId,
              collateralAddress(),
              accountId
            );
            // should have received all 3 past rewards
            assertBn.equal(rewards[0], rewardAmount.mul(2));
          });
        });

        describe('in the future', () => {
          before(restore);
          before(async () => {
            startTime = await getTime(provider());

            // this first one should never be received
            await RewardDistributor.connect(owner).distributeRewards(
              poolId,
              collateralAddress(),
              rewardAmount,
              startTime + 200, // timestamp
              200
            );

            startTime = await getTime(provider());

            // should b e received immediately
            await RewardDistributor.connect(owner).distributeRewards(
              poolId,
              collateralAddress(),
              rewardAmount,
              startTime - 50, // timestamp
              10
            );

            startTime = await getTime(provider());

            // add one after to test behavior of future distribution
            await RewardDistributor.connect(owner).distributeRewards(
              poolId,
              collateralAddress(),
              rewardAmount,
              startTime + 100, // timestamp
              100
            );
          });

          it('does not distribute future', async () => {
            const [rewards] = await systems().Core.callStatic.updateRewards(
              poolId,
              collateralAddress(),
              accountId
            );
            // should have received only the one past reward
            assertBn.equal(rewards[0], rewardAmount);
          });

          describe('after time passes', () => {
            before(async () => {
              await fastForwardTo(startTime + 200, provider());
            });

            it('is fully distributed', async () => {
              const [rewards] = await systems().Core.callStatic.updateRewards(
                poolId,
                collateralAddress(),
                accountId
              );
              // should have received 2 of 3 past rewards
              assertBn.equal(rewards[0], rewardAmount.mul(2));
            });
          });
        });

        describe('within duration', () => {
          before(restore);
          before(async () => {
            startTime = await getTime(provider());

            await RewardDistributor.connect(owner).distributeRewards(
              poolId,
              collateralAddress(),
              rewardAmount,
              startTime - 50, // timestamp
              0
            );

            startTime = await getTime(provider());

            await RewardDistributor.connect(owner).distributeRewards(
              poolId,
              collateralAddress(),
              rewardAmount,
              startTime - 50, // timestamp (time advances exactly 1 second due to block being mined)
              100
            );
          });

          it('distributes portion of rewards immediately', async () => {
            const [rewards] = await systems().Core.callStatic.updateRewards(
              poolId,
              collateralAddress(),
              accountId
            );
            // should have received only the one past reward
            // 51 because block advances by exactly 1 second due to mine
            assertBn.equal(rewards[0], rewardAmount.add(rewardAmount.mul(51).div(100)));
          });

          describe('after time passes', () => {
            before(async () => {
              await fastForwardTo(startTime + 25, provider());
            });

            it('distributes more portion of rewards', async () => {
              const [rewards] = await systems().Core.callStatic.updateRewards(
                poolId,
                collateralAddress(),
                accountId
              );
              // should have received only the one past reward + 1 second for simulate
              assertBn.equal(rewards[0], rewardAmount.add(rewardAmount.mul(75).div(100)));
            });

            describe('new distribution', () => {
              before(async () => {
                startTime = await getTime(provider());

                await RewardDistributor.connect(owner).distributeRewards(
                  poolId,
                  collateralAddress(),
                  rewardAmount.mul(1000),
                  startTime - 110, // timestamp
                  200
                );
              });

              it('distributes portion of rewards immediately', async () => {
                const [rewards] = await systems().Core.callStatic.updateRewards(
                  poolId,
                  collateralAddress(),
                  accountId
                );
                // should have received only the one past reward
                assertBn.equal(
                  rewards[0],
                  rewardAmount
                    .add(rewardAmount.mul(76).div(100))
                    .add(rewardAmount.mul(1000).mul(111).div(200))
                );
              });

              describe('after more time', () => {
                before(async () => {
                  await fastForwardTo(startTime + 100, provider());
                });

                it('distributes more portion of rewards', async () => {
                  const [rewards] = await systems().Core.callStatic.updateRewards(
                    poolId,
                    collateralAddress(),
                    accountId
                  );
                  // should have received only the one past reward
                  // +1 because block being mined by earlier txn
                  // +1 because the simulation adds an additional second
                  assertBn.equal(
                    rewards[0],
                    rewardAmount.mul(1001).add(rewardAmount.mul(76).div(100))
                  );
                });
              });
            });
          });
        });
      });
    });
    describe('wallets joining and leaving', () => {});
  });

  describe('claimRewards()', async () => {
    before(restore);

    before('distribute some reward', async () => {
      await RewardDistributor.connect(owner).distributeRewards(
        poolId,
        collateralAddress(),
        rewardAmount,
        0, // timestamp
        0
      );
    });

    it('only works with owner', async () => {
      await assertRevert(
        systems()
          .Core.connect(user2)
          .claimRewards(accountId, poolId, collateralAddress(), RewardDistributor.address),
        `PermissionDenied("${accountId}", "${Permissions.REWARDS}", "${await user2.getAddress()}")`,
        systems().Core
      );
    });

    describe('successful claim', () => {
      before('claim', async () => {
        await systems()
          .Core.connect(user1)
          .claimRewards(accountId, poolId, collateralAddress(), RewardDistributor.address);
      });

      it('pays out', async () => {
        assertBn.equal(await Collateral.balanceOf(await user1.getAddress()), rewardAmount);
      });

      it('returns no rewards remaining', async () => {
        const [rewards] = await systems().Core.callStatic.updateRewards(
          poolId,
          collateralAddress(),
          accountId
        );
        // should have received only the one past reward
        // +1 because block being mined by earlier txn
        // +1 because the simulation adds an additional second
        assertBn.equal(rewards[0], 0);
      });

      it('doesnt get any rewards on subsequent claim', async () => {
        await systems()
          .Core.connect(user1)
          .claimRewards(accountId, poolId, collateralAddress(), RewardDistributor.address);

        assertBn.equal(await Collateral.balanceOf(await user1.getAddress()), rewardAmount);
      });

      describe('second payout', async () => {
        before('distribute some reward', async () => {
          await RewardDistributor.connect(owner).distributeRewards(
            poolId,
            collateralAddress(),
            rewardAmount.div(2),
            0, // timestamp
            0
          );
        });

        before('claim', async () => {
          await systems()
            .Core.connect(user1)
            .claimRewards(accountId, poolId, collateralAddress(), RewardDistributor.address);
        });

        it('pays out', async () => {
          assertBn.equal(
            await Collateral.balanceOf(await user1.getAddress()),
            rewardAmount.add(rewardAmount.div(2))
          );
        });

        it('returns no rewards remaining', async () => {
          const [rewards] = await systems().Core.callStatic.updateRewards(
            poolId,
            collateralAddress(),
            accountId
          );
          // should have received only the one past reward
          // +1 because block being mined by earlier txn
          // +1 because the simulation adds an additional second
          assertBn.equal(rewards[0], 0);
        });

        it('does not get any rewards on subsequent claim', async () => {
          await systems()
            .Core.connect(user1)
            .claimRewards(accountId, poolId, collateralAddress(), RewardDistributor.address);

          assertBn.equal(
            await Collateral.balanceOf(await user1.getAddress()),
            rewardAmount.add(rewardAmount.div(2))
          );
        });
      });
    });
  });

  describe('removeRewardsDistributor()', async () => {
    before(restore);

    it('only works with owner', async () => {
      await assertRevert(
        systems()
          .Core.connect(user2)
          .removeRewardsDistributor(poolId, collateralAddress(), RewardDistributor.address),
        `Unauthorized("${await user2.getAddress()}")`,
        systems().Core
      );
    });

    it('pool owner can remove reward distributor', async () => {
      await systems()
        .Core.connect(owner)
        .removeRewardsDistributor(poolId, collateralAddress(), RewardDistributor.address);
    });

    it('make sure distributor is removed', async () => {
      await assertRevert(
        RewardDistributor.connect(owner).distributeRewards(
          poolId,
          collateralAddress(),
          rewardAmount,
          0, // timestamp
          0
        ),
        'InvalidParameter("poolId-collateralType-distributor", "reward is not registered")',
        systems().Core
      );
    });
  });
});
