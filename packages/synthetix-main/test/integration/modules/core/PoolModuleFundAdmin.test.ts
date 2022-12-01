import assert from 'node:assert';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import hre from 'hardhat';
import { ethers } from 'ethers';

import { bootstrapWithMockMarketAndPool } from '../../bootstrap';
import { snapshotCheckpoint } from '../../../utils';

describe('PoolModule Admin', function () {
  const {
    signers,
    systems,
    provider,
    accountId,
    poolId,
    MockMarket,
    marketId,
    collateralAddress,
    depositAmount,
    restore,
  } = bootstrapWithMockMarketAndPool();

  let owner: ethers.Signer, user1: ethers.Signer, user2: ethers.Signer;

  const secondPoolId = 3384692;

  const One = ethers.utils.parseEther('1');
  const Hundred = ethers.utils.parseEther('100');

  before('identify signers', async () => {
    [owner, user1, user2] = signers();
  });

  describe('createPool()', async () => {
    before(restore);

    it('fails when pool already exists', async () => {});

    describe('success', async () => {});

    before('give user1 permission to create pool', async () => {
      await systems()
        .Core.connect(owner)
        .addToFeatureFlagAllowlist(
          ethers.utils.formatBytes32String('createPool'),
          user1.getAddress()
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

  describe('setPoolConfiguration()', async () => {
    const marketId2 = 2;

    before('set dummy markets', async () => {
      const factory = await hre.ethers.getContractFactory('MockMarket');
      const MockMarket2 = await factory.connect(owner).deploy();
      const MockMarket3 = await factory.connect(owner).deploy();

      // owner has permission to register markets via bootstrap
      await (await systems().Core.connect(owner).registerMarket(MockMarket2.address)).wait();
      await (await systems().Core.connect(owner).registerMarket(MockMarket3.address)).wait();
    });

    const restore = snapshotCheckpoint(provider);

    it('reverts when pool does not exist', async () => {
      await assertRevert(
        systems()
          .Core.connect(user1)
          .setPoolConfiguration(834693286, [{ market: 1, weightD18: 1, maxDebtShareValueD18: 0 }]),
        'PoolNotFound(834693286)',
        systems().Core
      );
    });

    it('reverts when not owner', async () => {
      await assertRevert(
        systems()
          .Core.connect(user2)
          .setPoolConfiguration(poolId, [{ market: 1, weightD18: 1, maxDebtShareValueD18: 0 }]),
        `Unauthorized("${await user2.getAddress()}")`,
        systems().Core
      );
    });

    // in particular, this test needs to go here because we want to see it fail
    // even when there is no liquidity to rebalance
    it('reverts when a marketId does not exist', async () => {
      await assertRevert(
        systems()
          .Core.connect(owner)
          .setPoolConfiguration(poolId, [
            { market: 1, weightD18: 1, maxDebtShareValueD18: 0 },
            { market: 2, weightD18: 1, maxDebtShareValueD18: 0 },
            { market: 92197628, weightD18: 1, maxDebtShareValueD18: 0 },
          ]),
        'MarketNotFound(92197628)',
        systems().Core
      );
    });

    it('reverts when a marketId is duplicated', async () => {
      await assertRevert(
        systems()
          .Core.connect(owner)
          .setPoolConfiguration(poolId, [
            { market: 1, weightD18: 1, maxDebtShareValueD18: 0 },
            { market: 1, weightD18: 2, maxDebtShareValueD18: 0 },
          ]),
        'InvalidParameter',
        systems().Core
      );
    });

    it('reverts when a weight is 0', async () => {
      await assertRevert(
        systems()
          .Core.connect(owner)
          .setPoolConfiguration(poolId, [
            { market: 1, weightD18: 1, maxDebtShareValueD18: 0 },
            { market: 2, weightD18: 0, maxDebtShareValueD18: 0 },
          ]),
        'InvalidParameter',
        systems().Core
      );
    });

    it('sets market collateral configuration on bootstrap', async () => {
      assertBn.equal(
        await systems().Core.connect(owner).getMarketCollateral(marketId()),
        depositAmount
      );
    });

    describe('repeat pool sets position', async () => {
      before(restore);

      before('set pool position', async () => {
        await systems()
          .Core.connect(owner)
          .setPoolConfiguration(poolId, [
            { market: marketId(), weightD18: 1, maxDebtShareValueD18: One },
          ]);
      });

      it('sets market collateral', async () => {
        assertBn.equal(
          await systems().Core.connect(owner).getMarketCollateral(marketId()),
          depositAmount
        );
      });

      describe('pool changes staking position to add another market', async () => {
        before('set pool position', async () => {
          await systems()
            .Core.connect(owner)
            .setPoolConfiguration(poolId, [
              { market: marketId(), weightD18: 1, maxDebtShareValueD18: One },
              { market: marketId2, weightD18: 3, maxDebtShareValueD18: One },
            ]);
        });

        it('returns pool position correctly', async () => {
          const distributions = await systems().Core.getPoolConfiguration(poolId);

          assertBn.equal(distributions[0].market, marketId());
          assertBn.equal(distributions[0].weightD18, 1);
          assertBn.equal(distributions[0].maxDebtShareValueD18, One);
          assertBn.equal(distributions[1].market, marketId2);
          assertBn.equal(distributions[1].weightD18, 3);
          assertBn.equal(distributions[1].maxDebtShareValueD18, One);
        });

        it('sets market available liquidity', async () => {
          assertBn.equal(
            await systems().Core.connect(owner).getMarketCollateral(marketId()),
            depositAmount.div(4)
          );
          assertBn.equal(
            await systems().Core.connect(owner).getMarketCollateral(marketId2),
            depositAmount.mul(3).div(4)
          );
        });

        describe('market a little debt (below pool max)', () => {
          const debtAmount = Hundred.div(10);

          before('set market debt', async () => {
            await (await MockMarket().connect(owner).setReportedDebt(debtAmount)).wait();
          });

          it('market gave the end vault debt', async () => {
            assertBn.equal(
              await systems().Core.callStatic.getVaultDebt(poolId, collateralAddress()),
              debtAmount
            );
          });

          it('market still has withdrawable usd', async () => {
            assertBn.equal(
              await systems().Core.connect(owner).getWithdrawableUsd(marketId()),
              depositAmount.div(4)
            );
          });

          it('cannot exit if market is locked', async () => {
            await MockMarket().setLocked(ethers.utils.parseEther('1000'));

            await assertRevert(
              systems()
                .Core.connect(owner)
                .setPoolConfiguration(poolId, [
                  { market: marketId(), weightD18: 1, maxDebtShareValueD18: One },
                  // increase the weight of market2 to make the first market lower liquidity overall
                  { market: marketId2, weightD18: 9, maxDebtShareValueD18: One },
                ]),
              'CapacityLocked',
              systems().Core
            );

            // reduce market lock
            await MockMarket().setLocked(ethers.utils.parseEther('105'));

            // now the call should work (call static to not modify the state)
            await systems()
              .Core.connect(owner)
              .callStatic.setPoolConfiguration(poolId, [
                { market: marketId(), weightD18: 1, maxDebtShareValueD18: One },
                { market: marketId2, weightD18: 9, maxDebtShareValueD18: One },
              ]);

            // but a full pull-out shouldn't work
            await assertRevert(
              systems()
                .Core.connect(owner)
                .setPoolConfiguration(poolId, [
                  // completely remove the first market
                  { market: marketId2, weightD18: 9, maxDebtShareValueD18: One },
                ]),
              'CapacityLocked'
              //systems().Core
            );

            // undo lock change
            await MockMarket().setLocked(ethers.utils.parseEther('0'));
          });

          describe('exit first market', () => {
            const restore = snapshotCheckpoint(provider);

            before('set pool position', async () => {
              await systems()
                .Core.connect(owner)
                .setPoolConfiguration(poolId, [
                  { market: marketId2, weightD18: 3, maxDebtShareValueD18: One },
                ]);
            });

            it('returns pool position correctly', async () => {
              const distributions = await systems().Core.getPoolConfiguration(poolId);

              assertBn.equal(distributions[0].market, marketId2);
              assertBn.equal(distributions[0].weightD18, 3);
              assertBn.equal(distributions[0].maxDebtShareValueD18, One);
            });

            it('markets have same available liquidity', async () => {
              // marketId() gets to keep its available liquidity because when
              // the market exited when it did it "committed"
              assertBn.equal(
                await systems().Core.connect(owner).getWithdrawableUsd(marketId()),
                debtAmount
              );

              assertBn.equal(
                await systems().Core.connect(owner).getMarketCollateral(marketId()),
                0
              );
            });

            after(restore);
          });

          describe('exit second market', () => {
            const restore = snapshotCheckpoint(provider);

            before('set pool position', async () => {
              await systems()
                .Core.connect(owner)
                .setPoolConfiguration(poolId, [
                  { market: marketId(), weightD18: 2, maxDebtShareValueD18: One.mul(2) },
                ]);
            });

            it('returns pool position correctly', async () => {
              const distributions = await systems().Core.getPoolConfiguration(poolId);

              assertBn.equal(distributions[0].market, marketId());
              assertBn.equal(distributions[0].weightD18, 2);
              assertBn.equal(distributions[0].maxDebtShareValueD18, One.mul(2));
            });

            it('available liquidity taken away from second market', async () => {
              // marketId2 never reported an increased balance so its liquidity is 0 as ever
              assertBn.equal(await systems().Core.connect(owner).getMarketCollateral(marketId2), 0);
            });

            after(restore);
          });

          describe('exit both market', () => {
            before('set pool position', async () => {
              await systems().Core.connect(owner).setPoolConfiguration(poolId, []);
            });

            it('returns pool position correctly', async () => {
              assert.deepEqual(await systems().Core.getPoolConfiguration(poolId), []);
            });

            it('debt is still assigned', async () => {
              assertBn.equal(
                await systems().Core.callStatic.getVaultDebt(poolId, collateralAddress()),
                debtAmount
              );
            });

            it('markets have same available liquidity', async () => {
              // marketId() gets to keep its available liquidity because when
              // the market exited when it did it "committed"
              assertBn.equal(
                await systems().Core.connect(owner).getWithdrawableUsd(marketId()),
                debtAmount
              );

              // marketId2 never reported an increased balance so its liquidity is 0 as ever
              assertBn.equal(await systems().Core.connect(owner).getMarketCollateral(marketId2), 0);
            });
          });
        });
      });
    });

    describe('sets max debt below current debt share', async () => {
      before(restore);

      before('raise maxLiquidityRatio', async () => {
        // need to do this for the below test to work
        await systems().Core.connect(owner).setMinLiquidityRatio(ethers.utils.parseEther('0.2'));
      });

      before('set pool position', async () => {
        await systems()
          .Core.connect(owner)
          .setPoolConfiguration(poolId, [
            {
              market: marketId(),
              weightD18: 1,
              maxDebtShareValueD18: One.mul(One.mul(-1)).div(depositAmount),
            },
          ]);
      });

      // the second pool is here to test the calculation weighted average
      // and to test pool entering/joining after debt shifts
      before('set second pool position position', async () => {
        await systems().Core.connect(user1).delegateCollateral(
          accountId,
          secondPoolId,
          collateralAddress(),
          // deposit much more than the poolId pool so as to
          // skew the limit much higher than what it set
          depositAmount,
          ethers.utils.parseEther('1')
        );

        await systems()
          .Core.connect(user1)
          .setPoolConfiguration(secondPoolId, [
            {
              market: marketId(),
              weightD18: 1,
              maxDebtShareValueD18: One.mul(One).div(depositAmount).mul(2),
            },
          ]);
      });

      it('has only second pool market withdrawable usd', async () => {
        assertBn.equal(
          await systems().Core.connect(owner).getWithdrawableUsd(marketId()),
          One.mul(2)
        );
      });

      it('market collateral value is amount of only vault 2', async () => {
        assertBn.equal(
          await systems().Core.connect(user1).callStatic.getMarketCollateral(marketId()),
          depositAmount
        );
      });

      describe('and then the market goes below max debt and the pool is bumped', async () => {
        before('buy into the market', async () => {
          // to go below max debt, we have to get user to invest
          // in the market, and then reset the market

          // aquire USD from the zero pool
          await systems()
            .Core.connect(user1)
            .delegateCollateral(
              accountId,
              0,
              collateralAddress(),
              depositAmount,
              ethers.utils.parseEther('1')
            );

          await systems().Core.connect(user1).mintUsd(accountId, 0, collateralAddress(), Hundred);
          await systems().USD.connect(user1).approve(MockMarket().address, Hundred);
          await MockMarket().connect(user1).buySynth(Hundred);

          // "bump" the vault to get it to accept the position (in case there is a bug)
          await systems().Core.connect(user1).getVaultDebt(poolId, collateralAddress());
        });

        it('has same amount withdrawable usd + the allowed amount by the vault', async () => {
          assertBn.equal(
            await systems().Core.connect(owner).getWithdrawableUsd(marketId()),
            One.mul(2).add(Hundred)
          );

          // market hasn't reported any reduction in balance
          assertBn.equal(await systems().Core.connect(owner).getMarketTotalBalance(marketId()), 0);
        });

        it('did not change debt for connected vault', async () => {
          assertBn.equal(
            await systems().Core.callStatic.getVaultDebt(poolId, collateralAddress()),
            0
          );
        });

        describe('and then the market reports 0 balance', () => {
          before('set market', async () => {
            await MockMarket().connect(user1).setReportedDebt(0);
            await systems().Core.connect(user1).getVaultDebt(poolId, collateralAddress());
          });

          it('has accurate amount withdrawable usd', async () => {
            // should be exactly 102 (market2 2 + 100 deposit)
            // (market1 assumes no new debt as a result of balance going down,
            // but accounts/can pool can withdraw at a profit)
            assertBn.equal(
              await systems().Core.connect(owner).getWithdrawableUsd(marketId()),
              Hundred.add(One.mul(2))
            );
          });

          it('vault is credited', async () => {
            assertBn.equal(
              await systems().Core.callStatic.getVaultDebt(poolId, collateralAddress()),
              One.mul(-99).div(2)
            );
          });

          describe('and then the market reports 50 balance', () => {
            before('', async () => {
              await MockMarket().connect(user1).setReportedDebt(Hundred.div(2));
            });

            it('has same amount of withdrawable usd', async () => {
              assertBn.equal(
                await systems().Core.connect(owner).getWithdrawableUsd(marketId()),
                Hundred.add(One.mul(2))
              );
            });

            it('vault is debted', async () => {
              assertBn.equal(
                await systems().Core.callStatic.getVaultDebt(poolId, collateralAddress()),
                One.mul(-49).div(2)
              );
            });

            const restore = snapshotCheckpoint(provider);

            describe('and then the market reports balance above limit again', () => {
              before(restore);
              // testing the "soft" limit
              before('set market', async () => {
                await MockMarket().connect(user1).setReportedDebt(Hundred.add(One));
              });

              it('has same amount withdrawable usd + the allowed amount by the vault', async () => {
                assertBn.equal(
                  await systems().Core.connect(owner).getWithdrawableUsd(marketId()),
                  Hundred.add(One.mul(2))
                );
              });

              it('vault no longer has a surplus', async () => {
                assertBn.equal(
                  await systems().Core.callStatic.getVaultDebt(poolId, collateralAddress()),
                  0
                );
              });

              it('vault 2 assumes expected amount of debt', async () => {
                // vault 2 assumes the 1 dollar in debt that was not absorbed by the first pool
                // still below limit though
                assertBn.equal(
                  await systems().Core.callStatic.getVaultDebt(secondPoolId, collateralAddress()),
                  One
                );
              });

              it('market collateral value is amount of only vault 2', async () => {
                await systems().Core.connect(user1).getVaultDebt(poolId, collateralAddress());
                assertBn.equal(
                  await systems().Core.connect(user1).callStatic.getMarketCollateral(marketId()),
                  depositAmount
                );
              });
            });

            describe('and then the market reports balance above both pools limits', () => {
              before(restore);
              // testing the "soft" limit
              before('set market', async () => {
                await MockMarket().connect(user1).setReportedDebt(Hundred.mul(1234));

                // TODO: if the following line is removed/reordered an unusual error
                // appears where `secondPoolId` assumes the full amount of debt
                // we have to investigate this
                await systems().Core.connect(user1).getVaultDebt(poolId, collateralAddress());
                await systems().Core.connect(user1).getVaultDebt(secondPoolId, collateralAddress());
              });

              it('has same amount withdrawable usd + the allowed amount by the vault', async () => {
                assertBn.equal(
                  await systems().Core.connect(owner).getWithdrawableUsd(marketId()),
                  Hundred.add(One.mul(2))
                );
              });

              it('vault 1 assumes no debt', async () => {
                assertBn.equal(
                  await systems().Core.callStatic.getVaultDebt(poolId, collateralAddress()),
                  0
                );
              });

              it('vault 2 assumes expected amount of debt', async () => {
                assertBn.equal(
                  await systems().Core.callStatic.getVaultDebt(secondPoolId, collateralAddress()),
                  One.mul(2)
                );
              });

              it('the market has no more collateral assigned to it', async () => {
                await systems().Core.connect(user1).getVaultDebt(poolId, collateralAddress());
                assertBn.equal(
                  await systems().Core.connect(user1).callStatic.getMarketCollateral(marketId()),
                  0
                );
              });
            });
          });
        });
      });
    });

    describe('when limit is higher than minLiquidityRatio', async () => {
      before(restore);

      before('set minLiquidityRatio', async () => {
        // need to do this for the below test to work
        await systems().Core.connect(owner).setMinLiquidityRatio(ethers.utils.parseEther('2'));
      });

      before('set pool position', async () => {
        await systems()
          .Core.connect(owner)
          .setPoolConfiguration(poolId, [
            { market: marketId(), weightD18: 1, maxDebtShareValueD18: One },
          ]);
        await systems().Core.connect(user1).getVaultDebt(poolId, collateralAddress());
      });

      it('withdrawable usd reflects minLiquidityRatio', async () => {
        assertBn.equal(
          await systems().Core.connect(owner).getWithdrawableUsd(marketId()),
          depositAmount.div(2)
        );
      });

      describe('when minLiquidityRatio is decreased', async () => {
        before('set minLiquidityRatio', async () => {
          await systems().Core.connect(owner).setMinLiquidityRatio(ethers.utils.parseEther('1'));

          // bump the vault
          await systems().Core.connect(user1).getVaultDebt(poolId, collateralAddress());
        });

        it('withdrawable usd reflects configured by pool', async () => {
          assertBn.equal(
            await systems().Core.connect(owner).getWithdrawableUsd(marketId()),
            depositAmount
          );
        });
      });
    });
  });

  describe('setMinLiquidityRatio()', async () => {
    it('only works for owner', async () => {
      await assertRevert(
        systems().Core.connect(user1).setMinLiquidityRatio(ethers.utils.parseEther('2')),
        'Unauthorized',
        systems().Core
      );
    });

    describe('when invoked successfully', async () => {
      before('set', async () => {
        await systems().Core.connect(owner).setMinLiquidityRatio(ethers.utils.parseEther('2'));
      });

      it('is set', async () => {
        assertBn.equal(await systems().Core.getMinLiquidityRatio(), ethers.utils.parseEther('2'));
      });
    });
  });
});
