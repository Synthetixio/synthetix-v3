import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assert from 'assert/strict';
import { fastForward, fastForwardTo, getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { ethers } from 'ethers';
import hre from 'hardhat';
import { RewardDistributorMock, CollateralMock } from '../../../../typechain-types/index';
import { bootstrapWithStakedPool } from '../../bootstrap';
import Permissions from '../../mixins/AccountRBACMixin.permissions';
import { verifyUsesFeatureFlag } from '../../verifications';

// ---------------------------------------
// If the tests are failing Make sure you run foundryup to update the anvil to latest version
// ---------------------------------------

describe('RewardsManagerModule', function () {
  this.timeout(120000);
  const { provider, signers, systems, poolId, collateralAddress, accountId } =
    bootstrapWithStakedPool();

  let owner: ethers.Signer, user1: ethers.Signer, user2: ethers.Signer;

  let Collateral: CollateralMock;
  let Collateral2: CollateralMock;
  let RewardDistributor: RewardDistributorMock;
  let RewardDistributorPoolLevel: RewardDistributorMock;

  const rewardAmount = ethers.utils.parseEther('1000');

  let startTime: number;

  before('identify signers', async () => {
    [owner, user1, user2] = signers();
  });

  before('deploy fake reward token', async () => {
    const factory = await hre.ethers.getContractFactory('CollateralMock');
    Collateral = await factory.connect(owner).deploy();
    Collateral2 = await factory.connect(owner).deploy();

    await (await Collateral.connect(owner).initialize('Fake Reward', 'FAKE', 6)).wait();
    await (await Collateral.connect(owner).initialize('Fake Reward 2', 'FAKE2', 6)).wait();
  });

  before('deploy fake reward distributor', async () => {
    const factory = await hre.ethers.getContractFactory('RewardDistributorMock');
    RewardDistributor = await factory.connect(owner).deploy();
    RewardDistributorPoolLevel = await factory.connect(owner).deploy();

    await RewardDistributor.connect(owner).initialize(
      systems().Core.address,
      Collateral.address,
      'Fake Reward Distributor'
    );

    await RewardDistributorPoolLevel.connect(owner).initialize(
      systems().Core.address,
      Collateral.address,
      'Fake Pool Level Distributor'
    );

    await systems()
      .Core.connect(owner)
      .configureCollateral({
        tokenAddress: Collateral2.address,
        oracleNodeId: (await systems().Core.getCollateralConfiguration(collateralAddress()))
          .oracleNodeId,
        issuanceRatioD18: '5000000000000000000',
        liquidationRatioD18: '1500000000000000000',
        liquidationRewardD18: '20000000000000000000',
        minDelegationD18: '20000000000000000000',
        depositingEnabled: true,
      });
  });

  before('mint token for the reward distributor', async () => {
    await Collateral.mint(RewardDistributor.address, rewardAmount.mul(1000));
    await Collateral.mint(RewardDistributorPoolLevel.address, rewardAmount.mul(1000));

    // for later
    await Collateral2.mint(await owner.getAddress(), rewardAmount.mul(1000));
  });

  before(async () => {
    //register reward distribution
    await systems()
      .Core.connect(owner)
      .registerRewardsDistributor(poolId, collateralAddress(), RewardDistributor.address);
    //register pool level rd
    await systems()
      .Core.connect(owner)
      .registerRewardsDistributor(
        poolId,
        ethers.constants.AddressZero,
        RewardDistributorPoolLevel.address
      );

    // register another pool level rd with the same top level vault level RD
    const txn = await systems()
      .Core.connect(owner)
      .registerRewardsDistributor(poolId, ethers.constants.AddressZero, RewardDistributor.address);

    await txn.wait();
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
              1, // timestamp
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

      it('allows distribution with start time equal to 0', async () => {
        await RewardDistributor.connect(owner).callStatic.distributeRewards(
          poolId,
          collateralAddress(),
          rewardAmount,
          0, // timestamp
          0
        );
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
              1, // timestamp
              0
            );

            startTime = await getTime(provider());

            await RewardDistributor.connect(owner).distributeRewards(
              poolId,
              collateralAddress(),
              rewardAmount,
              2, // timestamp
              0
            );

            startTime = await getTime(provider());

            await RewardDistributor.connect(owner).distributeRewards(
              poolId,
              collateralAddress(),
              rewardAmount,
              2, // timestamp
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
            const availableRewards = await systems().Core.callStatic.getAvailableRewards(
              accountId,
              poolId,
              collateralAddress(),
              RewardDistributor.address
            );

            // 3 distributions should be available
            assertBn.equal(availableRewards, rewardAmount.mul(3));
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
            const rewardsAvailable = await systems()
              .Core.connect(user1)
              .callStatic.getAvailableRewards(
                accountId,
                poolId,
                collateralAddress(),
                RewardDistributor.address
              );

            // only one reward should have been distributed and be available
            assertBn.equal(rewardsAvailable, rewardAmount);
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
              await systems().Core.updateRewards(poolId, collateralAddress(), accountId);

              const rewardsAvailable = await systems()
                .Core.connect(user1)
                .callStatic.getAvailableRewards(
                  accountId,
                  poolId,
                  collateralAddress(),
                  RewardDistributor.address
                );

              assertBn.equal(rewardsAvailable, rewardAmount.mul(2));
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
            const availableRewards = await systems()
              .Core.connect(user1)
              .callStatic.getAvailableRewards(
                accountId,
                poolId,
                collateralAddress(),
                RewardDistributor.address
              );
            // All 3 past rewards should be available to claim
            assertBn.equal(availableRewards, rewardAmount.mul(2));
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
            const availableRewards = await systems()
              .Core.connect(user1)
              .callStatic.getAvailableRewards(
                accountId,
                poolId,
                collateralAddress(),
                RewardDistributor.address
              );

            // should have received only the one past reward
            assertBn.equal(availableRewards, rewardAmount);
          });

          describe('after time passes', () => {
            before(async () => {
              await fastForwardTo(startTime + 200, provider());
            });

            it('is fully distributed', async () => {
              const availableRewards = await systems()
                .Core.connect(user1)
                .callStatic.getAvailableRewards(
                  accountId,
                  poolId,
                  collateralAddress(),
                  RewardDistributor.address
                );

              // should have received 2 of 3 past rewards
              assertBn.equal(availableRewards, rewardAmount.mul(2));
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
            const availableRewards = await systems()
              .Core.connect(user1)
              .callStatic.getAvailableRewards(
                accountId,
                poolId,
                collateralAddress(),
                RewardDistributor.address
              );

            // should have received only the one past reward
            // 51 because block advances by exactly 1 second due to mine
            assertBn.equal(availableRewards, rewardAmount.add(rewardAmount.mul(51).div(100)));
          });

          describe('after time passes', () => {
            before(async () => {
              await fastForwardTo(startTime + 25, provider());
            });

            it('distributes more portion of rewards', async () => {
              const availableRewards = await systems()
                .Core.connect(user1)
                .callStatic.getAvailableRewards(
                  accountId,
                  poolId,
                  collateralAddress(),
                  RewardDistributor.address
                );

              // should have received only the one past reward + 1 second for simulate
              assertBn.equal(availableRewards, rewardAmount.add(rewardAmount.mul(75).div(100)));
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
                const availableRewards = await systems()
                  .Core.connect(user1)
                  .callStatic.getAvailableRewards(
                    accountId,
                    poolId,
                    collateralAddress(),
                    RewardDistributor.address
                  );

                // should have received only the one past reward
                assertBn.equal(
                  availableRewards,
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
                  const availableRewards = await systems()
                    .Core.connect(user1)
                    .callStatic.getAvailableRewards(
                      accountId,
                      poolId,
                      collateralAddress(),
                      RewardDistributor.address
                    );
                  // should have received only the one past reward
                  // +1 because block being mined by earlier txn
                  // +1 because the simulation adds an additional second
                  assertBn.equal(
                    availableRewards,
                    rewardAmount.mul(1001).add(rewardAmount.mul(76).div(100))
                  );
                });
              });
            });
          });
        });
      });
    });

    describe('distributeRewardsByOwner', () => {
      before(restore);

      it('reverts if not pool owner', async () => {
        await assertRevert(
          systems()
            .Core.connect(await user1.getAddress())
            .distributeRewardsByOwner(
              poolId,
              collateralAddress(),
              RewardDistributor.address,
              rewardAmount,
              0, // timestamp
              0
            ),
          `Unauthorized("${await user1.getAddress()}")`
        );
      });

      it('reverts if RD does not exist', async () => {
        await assertRevert(
          systems()
            .Core.connect(owner)
            .distributeRewardsByOwner(
              poolId,
              collateralAddress(),
              await user1.getAddress(),
              rewardAmount,
              0, // timestamp
              0
            ),
          'InvalidParameter("poolId-collateralType-distributor", "reward is not registered")'
        );
      });
    });

    describe('wallets joining and leaving', () => {});
  });

  describe('updateRewards()', async () => {
    before(restore);

    it('only works with existing account', async () => {
      await assertRevert(
        systems().Core.connect(owner).updateRewards(poolId, collateralAddress(), 276823567823),
        'AccountNotFound(',
        systems().Core
      );
    });

    it('returns expected values', async () => {
      await RewardDistributor.connect(owner).distributeRewards(
        poolId,
        collateralAddress(),
        rewardAmount,
        1, // timestamp
        0
      );
      await RewardDistributor.connect(owner).distributeRewards(
        poolId,
        ethers.constants.AddressZero,
        rewardAmount.div(5),
        1, // timestamp
        0
      );
      await RewardDistributorPoolLevel.connect(owner).distributeRewards(
        poolId,
        ethers.constants.AddressZero,
        rewardAmount.div(2),
        1, // timestamp
        0
      );

      const [rewardAmounts, distributorAddresses, poolRewardsCount] =
        await systems().Core.callStatic.updateRewards(poolId, collateralAddress(), accountId);

      assertBn.equal(rewardAmounts.length, 3);
      assertBn.equal(distributorAddresses.length, 3);
      assertBn.equal(poolRewardsCount, 2);

      assert(distributorAddresses[0], RewardDistributorPoolLevel.address); // the pool level distributor
      assert(distributorAddresses[1], RewardDistributor.address); // the pool level distributor for the vault distributor
      assert(distributorAddresses[2], RewardDistributor.address); // the vault level distributor for the vault distributor
      assertBn.equal(rewardAmounts[0], rewardAmount.div(2));
      assertBn.equal(rewardAmounts[1], rewardAmount.div(5));
      assertBn.equal(rewardAmounts[2], rewardAmount);
    });
  });

  describe('claimRewards()', async () => {
    before(restore);

    before('distribute some reward', async () => {
      await RewardDistributor.connect(owner).distributeRewards(
        poolId,
        collateralAddress(),
        rewardAmount,
        1, // timestamp
        0
      );
      await RewardDistributorPoolLevel.connect(owner).distributeRewards(
        poolId,
        ethers.constants.AddressZero,
        rewardAmount,
        1, // timestamp
        0
      );
      await RewardDistributor.connect(owner).distributeRewards(
        poolId,
        ethers.constants.AddressZero,
        rewardAmount,
        1, // timestamp
        0
      );

      await systems().Core.updateRewards(poolId, collateralAddress(), accountId);

      // for the pool rewards distributor, have a new user join in after the distribution to verify
      // they dont get unjustified stake
      await (await systems().Core.connect(owner)['createAccount(uint128)']('2222')).wait();
      await (
        await Collateral2.connect(owner).approve(
          systems().Core.address,
          ethers.constants.MaxUint256
        )
      ).wait();
      await (
        await systems().Core.connect(owner).deposit(2222, Collateral2.address, rewardAmount)
      ).wait();
      await (
        await systems()
          .Core.connect(owner)
          .delegateCollateral(
            2222,
            poolId,
            Collateral2.address,
            rewardAmount,
            ethers.utils.parseEther('1')
          )
      ).wait();

      // have a new user join in after the distribution to verify
      // they dont get unjustified stake
      await (
        await systems()
          .CollateralMock.connect(owner)
          .mint(await owner.getAddress(), rewardAmount)
      ).wait();
      await (
        await systems()
          .CollateralMock.connect(owner)
          .approve(systems().Core.address, ethers.constants.MaxUint256)
      ).wait();
      await (
        await systems().Core.connect(owner).deposit(2222, collateralAddress(), rewardAmount)
      ).wait();
      await (
        await systems()
          .Core.connect(owner)
          .delegateCollateral(
            2222,
            poolId,
            collateralAddress(),
            rewardAmount,
            ethers.utils.parseEther('1')
          )
      ).wait();
    });

    const claimRestore = snapshotCheckpoint(provider);

    it('only works with owner', async () => {
      await assertRevert(
        systems()
          .Core.connect(user2)
          .claimRewards(accountId, poolId, collateralAddress(), RewardDistributor.address),
        `PermissionDenied("${accountId}", "${Permissions.REWARDS}", "${await user2.getAddress()}")`,
        systems().Core
      );
    });

    verifyUsesFeatureFlag(
      () => systems().Core,
      'claimRewards',
      () =>
        systems()
          .Core.connect(user1)
          .claimRewards(accountId, poolId, collateralAddress(), RewardDistributor.address)
    );

    describe('when distributor payout returns false', async () => {
      before('set fail', async () => {
        await RewardDistributor.connect(owner).setShouldFailPayout(true);
      });

      after('set fail', async () => {
        await RewardDistributor.connect(owner).setShouldFailPayout(false);
      });

      it('reverts', async () => {
        await assertRevert(
          systems()
            .Core.connect(user1)
            .claimRewards(accountId, poolId, collateralAddress(), RewardDistributor.address),
          `RewardUnavailable("${RewardDistributor.address}")`,
          systems().Core
        );
      });
    });

    describe('successful claim', () => {
      before(claimRestore);
      before('claim', async () => {
        await systems()
          .Core.connect(user1)
          .claimRewards(accountId, poolId, collateralAddress(), RewardDistributor.address);
        await systems()
          .Core.connect(user1)
          .claimPoolRewards(accountId, poolId, collateralAddress(), RewardDistributor.address);
      });

      it('pays out', async () => {
        // should have received 2x reward amount because both pool level and vault level should have dished
        assertBn.equal(await Collateral.balanceOf(await user1.getAddress()), rewardAmount.mul(2));
      });

      it('returns no rewards remaining', async () => {
        await systems().Core.updateRewards(poolId, collateralAddress(), accountId);

        const availableRewards = await systems()
          .Core.connect(user1)
          .callStatic.getAvailableRewards(
            accountId,
            poolId,
            collateralAddress(),
            RewardDistributor.address
          );

        const availableRewardsPool = await systems()
          .Core.connect(user1)
          .callStatic.getAvailablePoolRewards(
            accountId,
            poolId,
            ethers.constants.AddressZero,
            RewardDistributor.address
          );

        assertBn.equal(availableRewards, 0);
        assertBn.equal(availableRewardsPool, 0);
      });

      it('doesnt get any rewards on subsequent claim', async () => {
        const availableRewards = await systems()
          .Core.connect(user1)
          .callStatic.getAvailableRewards(
            accountId,
            poolId,
            collateralAddress(),
            RewardDistributor.address
          );

        await assertRevert(
          systems()
            .Core.connect(user1)
            .claimRewards(accountId, poolId, collateralAddress(), RewardDistributor.address),
          'InvalidParameter("amount", "Zero amount")',
          systems().Core
        );

        assertBn.equal(await Collateral.balanceOf(await user1.getAddress()), rewardAmount.mul(2));
        assertBn.equal(availableRewards, 0);
      });

      describe('second payout', async () => {
        before('distribute some reward', async () => {
          await RewardDistributor.connect(owner).distributeRewards(
            poolId,
            collateralAddress(),
            rewardAmount.div(2),
            1, // timestamp
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
            rewardAmount.mul(2).add(rewardAmount.div(4))
          );
        });

        it('returns no rewards remaining', async () => {
          const rewardAmount = await systems()
            .Core.connect(user1)
            .callStatic.getAvailableRewards(
              accountId,
              poolId,
              collateralAddress(),
              RewardDistributor.address
            );

          assertBn.equal(rewardAmount, 0);
        });

        it('does not get any rewards on subsequent claim', async () => {
          await assertRevert(
            systems()
              .Core.connect(user1)
              .claimRewards(accountId, poolId, collateralAddress(), RewardDistributor.address),
            'InvalidParameter("amount", "Zero amount")',
            systems().Core
          );

          assertBn.equal(
            await Collateral.balanceOf(await user1.getAddress()),
            rewardAmount.mul(2).add(rewardAmount.div(4))
          );
        });
      });
    });

    describe('successful claim (pool level)', () => {
      before(claimRestore);
      before('claim', async () => {
        await (
          await systems()
            .Core.connect(user1)
            // NOTE: we use `collateralAddress` instead of `ethers.utils.AddressZero` here becuase here the claim function will look at the distributor address to determine if its pool level
            .claimPoolRewards(
              accountId,
              poolId,
              collateralAddress(),
              RewardDistributorPoolLevel.address
            )
        ).wait();
      });

      it('pays out', async () => {
        assertBn.equal(await Collateral.balanceOf(await user1.getAddress()), rewardAmount);
      });

      it('returns no rewards remaining', async () => {
        const availableRewards = await systems()
          .Core.connect(user1)
          .callStatic.getAvailablePoolRewards(
            accountId,
            poolId,
            collateralAddress(),
            RewardDistributorPoolLevel.address
          );

        assertBn.equal(availableRewards, 0);

        await systems().Core.updateRewards(poolId, collateralAddress(), accountId);

        const availableRewards2 = await systems()
          .Core.connect(user1)
          .callStatic.getAvailablePoolRewards(
            accountId,
            poolId,
            collateralAddress(),
            RewardDistributorPoolLevel.address
          );

        assertBn.equal(availableRewards2, 0);
      });

      it('user who joined after distribution has no rewards', async () => {
        const availableRewards = await systems()
          .Core.connect(user1)
          .callStatic.getAvailablePoolRewards(
            2222,
            poolId,
            collateralAddress(),
            RewardDistributorPoolLevel.address
          );

        assertBn.equal(availableRewards, 0);
      });

      it('user in 2nd collateral type cant claim anything (because they came in later)', async () => {
        await systems().Core.updateRewards(poolId, Collateral2.address, 2222);

        const availableRewards = await systems()
          .Core.connect(user1)
          .callStatic.getAvailablePoolRewards(
            2222,
            poolId,
            Collateral2.address,
            RewardDistributorPoolLevel.address
          );

        assertBn.equal(availableRewards, 0);

        await systems().Core.updateRewards(poolId, collateralAddress(), 2222);
        await systems().Core.updateRewards(poolId, Collateral2.address, 2222);

        const availableRewards2 = await systems()
          .Core.connect(owner)
          .callStatic.getAvailablePoolRewards(
            2222,
            poolId,
            Collateral2.address,
            RewardDistributorPoolLevel.address
          );

        assertBn.equal(availableRewards2, 0);
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

    before('distribute some rewards before removal', async function () {
      await RewardDistributor.connect(owner).distributeRewards(
        poolId,
        collateralAddress(),
        rewardAmount,
        1, // timestamp
        10
      );

      await RewardDistributor.connect(owner).distributeRewards(
        poolId,
        ethers.constants.AddressZero,
        rewardAmount,
        1, // timestamp
        10
      );
    });

    describe('successful invoke', async () => {
      before('distribute some reward', async () => {
        const time = await getTime(provider());
        await RewardDistributor.connect(owner).distributeRewards(
          poolId,
          collateralAddress(),
          rewardAmount,
          time,
          time + 100
        );
      });

      before('remove', async () => {
        await systems()
          .Core.connect(owner)
          .removeRewardsDistributor(poolId, collateralAddress(), RewardDistributor.address);
        await systems()
          .Core.connect(owner)
          .removeRewardsDistributor(
            poolId,
            ethers.constants.AddressZero,
            RewardDistributorPoolLevel.address
          );
      });

      it('make sure distributor is removed', async () => {
        await assertRevert(
          RewardDistributor.connect(owner).distributeRewards(
            poolId,
            collateralAddress(),
            rewardAmount,
            1, // timestamp
            0
          ),
          'InvalidParameter("poolId-collateralType-distributor", "reward is not registered")',
          systems().Core
        );
        await assertRevert(
          RewardDistributorPoolLevel.connect(owner).distributeRewards(
            poolId,
            ethers.constants.AddressZero,
            rewardAmount,
            1, // timestamp
            0
          ),
          'InvalidParameter("poolId-collateralType-distributor", "reward is not registered")',
          systems().Core
        );
      });

      it('can still claim accumulated rewards', async () => {
        const beforeBalance = await Collateral.balanceOf(await user1.getAddress());

        const rewardAmount = await systems()
          .Core.connect(user1)
          .callStatic.getAvailableRewards(
            accountId,
            poolId,
            collateralAddress(),
            RewardDistributor.address
          );

        await systems()
          .Core.connect(user1)
          .claimRewards(accountId, poolId, collateralAddress(), RewardDistributor.address);

        // make sure some rewards were actually distributed from the over time distribution
        const afterBalance = await Collateral.balanceOf(await user1.getAddress());
        assertBn.gt(afterBalance, beforeBalance);

        // Make sure the original getAvailableRewards balance is the same as the transferred amount
        assertBn.equal(rewardAmount, afterBalance);

        await systems().Core.updateRewards(poolId, collateralAddress(), accountId);

        const afterRewardAmount = await systems()
          .Core.connect(user1)
          .callStatic.getAvailableRewards(
            accountId,
            poolId,
            collateralAddress(),
            RewardDistributor.address
          );

        // Ensure that the available rewards are now 0
        assertBn.equal(afterRewardAmount, 0);

        await fastForward(1000, provider());

        // after first claim there should be no more additional rewards to claim
        await assertRevert(
          systems()
            .Core.connect(user1)
            .claimRewards(accountId, poolId, collateralAddress(), RewardDistributor.address),
          'InvalidParameter("amount", "Zero amount")'
        );
      });

      it('cannot be re-registered', async () => {
        await assertRevert(
          systems()
            .Core.connect(owner)
            .registerRewardsDistributor(poolId, collateralAddress(), RewardDistributor.address),
          'InvalidParameter("distributor", "cant be re-registered")',
          systems().Core
        );
        await assertRevert(
          systems()
            .Core.connect(owner)
            .registerRewardsDistributor(
              poolId,
              ethers.constants.AddressZero,
              RewardDistributorPoolLevel.address
            ),
          'InvalidParameter("distributor", "cant be re-registered")',
          systems().Core
        );
      });
    });
  });
});
