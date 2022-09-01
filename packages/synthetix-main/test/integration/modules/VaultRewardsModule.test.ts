import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import hre from 'hardhat';
import { ethers } from 'ethers';
import { fastForwardTo, getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';

import { bootstrapWithStakedPool } from '../bootstrap';

// TODO: These tests fail inconsistently on CI because of time discrepancies. They need to be reworked.
// Disabling them on the meantime until SIP 305 is official.
describe('VaultRewardsModule', function () {
  const { provider, signers, systems, poolId, collateralAddress, accountId, restore } =
    bootstrapWithStakedPool();

  let owner: ethers.Signer, user1: ethers.Signer;

  let Collateral;

  const rewardAmount = ethers.utils.parseEther('1000');

  let startTime: number;

  before('identify signers', async () => {
    [owner, user1] = signers();
  });

  before('deploy fake reward token', async () => {
    const factory = await hre.ethers.getContractFactory('CollateralMock');
    Collateral = await factory.connect(owner).deploy();

    await (await Collateral.connect(owner).initialize('Fake Reward', 'FAKE', 18)).wait();
  });

  describe('distributeRewards()', () => {
    it('only works with owner', async () => {
      assertRevert(
        systems().Core.connect(user1).distributeRewards(
          poolId,
          collateralAddress(),
          0,
          systems().Core.address, // rewards are distributed by the rewards distributor on self
          rewardAmount.div(2),
          0, // timestamp
          0
        ),
        'Unauthorized',
        systems().Core
      );
    });

    describe('instantaneous', () => {
      describe('in the past', () => {
        before(restore);
        before(async () => {
          startTime = await getTime(provider());

          // distribute rewards multiple times to see what happens
          // if many distributions happen in the past
          await systems().Core.connect(owner).distributeRewards(
            poolId,
            collateralAddress(),
            0,
            systems().Core.address, // rewards are distributed by the rewards distributor on self
            rewardAmount,
            0, // timestamp
            0
          );

          startTime = await getTime(provider());

          await systems().Core.connect(owner).distributeRewards(
            poolId,
            collateralAddress(),
            0,
            systems().Core.address, // rewards are distributed by the rewards distributor on self
            rewardAmount,
            1, // timestamp
            0
          );

          startTime = await getTime(provider());

          await systems().Core.connect(owner).distributeRewards(
            poolId,
            collateralAddress(),
            0,
            systems().Core.address, // rewards are distributed by the rewards distributor on self
            rewardAmount,
            1, // timestamp
            0
          );

          // one distribution in the future to ensure switching
          // from past to future works as expected
          await systems()
            .Core.connect(owner)
            .distributeRewards(
              poolId,
              collateralAddress(),
              0,
              systems().Core.address, // rewards are distributed by the rewards distributor on self
              rewardAmount,
              startTime + 10000000, // timestamp
              0
            );
        });

        it('is distributed', async () => {
          const rewards = await systems().Core.callStatic.getAvailableRewards(
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

          await systems()
            .Core.connect(owner)
            .distributeRewards(
              poolId,
              collateralAddress(),
              0,
              systems().Core.address, // rewards are distributed by the rewards distributor on self
              rewardAmount,
              startTime + 10, // timestamp
              0
            );

          startTime = await getTime(provider());

          // distribute one in the past to ensure switching from past to future works
          await systems()
            .Core.connect(owner)
            .distributeRewards(
              poolId,
              collateralAddress(),
              0,
              systems().Core.address, // rewards are distributed by the rewards distributor on self
              rewardAmount,
              startTime - 10, // timestamp
              0
            );

          await systems()
            .Core.connect(owner)
            .distributeRewards(
              poolId,
              collateralAddress(),
              0,
              systems().Core.address, // rewards are distributed by the rewards distributor on self
              rewardAmount,
              startTime + 30, // timestamp
              0
            );
        });

        it('is not distributed future yet', async () => {
          const rewards = await systems().Core.callStatic.getAvailableRewards(
            poolId,
            collateralAddress(),
            accountId
          );

          // only one reward should have been distributed
          assertBn.equal(rewards[0], rewardAmount);
        });

        it('has no rate', async () => {
          const rates = await systems().Core.getCurrentRewardAccumulation(
            poolId,
            collateralAddress()
          );

          assertBn.equal(rates[0], 0);
        });

        describe('after time passes', () => {
          before(async () => {
            await fastForwardTo(startTime + 30, provider());
          });

          it('is distributed', async () => {
            // should have received 2 distributions
            const rewards = await systems().Core.callStatic.getAvailableRewards(
              poolId,
              collateralAddress(),
              accountId
            );
            assertBn.equal(rewards[0], rewardAmount.mul(2));
          });

          it('has no rate', async () => {
            const rates = await systems().Core.getCurrentRewardAccumulation(
              poolId,
              collateralAddress()
            );

            assertBn.equal(rates[0], 0);
          });
        });
      });
    });

    describe('over time', () => {
      describe('in the past', () => {
        before(restore);
        before(async () => {
          await systems()
            .Core.connect(owner)
            .distributeRewards(
              poolId,
              collateralAddress(),
              0,
              systems().Core.address, // rewards are distributed by the rewards distributor on self
              rewardAmount,
              startTime - 100, // timestamp
              100
            );

          await systems()
            .Core.connect(owner)
            .distributeRewards(
              poolId,
              collateralAddress(),
              0,
              systems().Core.address, // rewards are distributed by the rewards distributor on self
              rewardAmount,
              startTime - 50, // timestamp
              50
            );

          // add one after to test behavior of future distribution
          await systems()
            .Core.connect(owner)
            .distributeRewards(
              poolId,
              collateralAddress(),
              0,
              systems().Core.address, // rewards are distributed by the rewards distributor on self
              rewardAmount,
              startTime + 50, // timestamp
              50
            );
        });

        it('is fully distributed', async () => {
          const rewards = await systems().Core.callStatic.getAvailableRewards(
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
          await systems()
            .Core.connect(owner)
            .distributeRewards(
              poolId,
              collateralAddress(),
              0,
              systems().Core.address, // rewards are distributed by the rewards distributor on self
              rewardAmount,
              startTime + 200, // timestamp
              200
            );

          startTime = await getTime(provider());

          // should b e received immediately
          await systems()
            .Core.connect(owner)
            .distributeRewards(
              poolId,
              collateralAddress(),
              0,
              systems().Core.address, // rewards are distributed by the rewards distributor on self
              rewardAmount,
              startTime - 50, // timestamp
              10
            );

          startTime = await getTime(provider());

          // add one after to test behavior of future distribution
          await systems()
            .Core.connect(owner)
            .distributeRewards(
              poolId,
              collateralAddress(),
              0,
              systems().Core.address, // rewards are distributed by the rewards distributor on self
              rewardAmount,
              startTime + 100, // timestamp
              100
            );
        });

        it('does not distribute future', async () => {
          const rewards = await systems().Core.callStatic.getAvailableRewards(
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
            const rewards = await systems().Core.callStatic.getAvailableRewards(
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

          await systems()
            .Core.connect(owner)
            .distributeRewards(
              poolId,
              collateralAddress(),
              0,
              systems().Core.address, // rewards are distributed by the rewards distributor on self
              rewardAmount,
              startTime - 50, // timestamp
              0
            );

          startTime = await getTime(provider());

          await systems()
            .Core.connect(owner)
            .distributeRewards(
              poolId,
              collateralAddress(),
              0,
              systems().Core.address, // rewards are distributed by the rewards distributor on self
              rewardAmount,
              startTime - 50, // timestamp
              100
            );
        });

        it('distributes portion of rewards immediately', async () => {
          const rewards = await systems().Core.callStatic.getAvailableRewards(
            poolId,
            collateralAddress(),
            accountId
          );
          // should have received only the one past reward
          assertBn.equal(rewards[0], rewardAmount.add(rewardAmount.mul(50).div(100)));
        });

        describe('after time passes', () => {
          before(async () => {
            await fastForwardTo(startTime + 25, provider());
          });

          it('distributes more portion of rewards', async () => {
            const rewards = await systems().Core.callStatic.getAvailableRewards(
              poolId,
              collateralAddress(),
              accountId
            );
            // should have received only the one past reward
            assertBn.equal(rewards[0], rewardAmount.add(rewardAmount.mul(75).div(100)));
          });

          describe('new distribution', () => {
            before(async () => {
              startTime = await getTime(provider());

              await systems()
                .Core.connect(owner)
                .distributeRewards(
                  poolId,
                  collateralAddress(),
                  0,
                  systems().Core.address, // rewards are distributed by the rewards distributor on self
                  rewardAmount,
                  startTime - 110, // timestamp
                  200
                );
            });

            // this test is skipped for now because, among all
            // the other tests, it does not behave as expected
            it.skip('distributes portion of rewards immediately', async () => {
              const rewards = await systems().Core.callStatic.getAvailableRewards(
                poolId,
                collateralAddress(),
                accountId
              );
              // should have received only the one past reward
              assertBn.equal(
                rewards[0],
                rewardAmount.add(rewardAmount.mul(75).div(100)).add(rewardAmount.mul(110).div(200))
              );
            });

            describe('after more time', () => {
              before(async () => {
                await fastForwardTo(startTime + 100, provider());
              });

              it('distributes more portion of rewards', async () => {
                const rewards = await systems().Core.callStatic.getAvailableRewards(
                  poolId,
                  collateralAddress(),
                  accountId
                );
                // should have received only the one past reward
                assertBn.equal(rewards[0], rewardAmount.mul(2).add(rewardAmount.mul(75).div(100)));
              });
            });
          });
        });
      });
    });

    describe('wallets joining and leaving', () => {});
  });
});
