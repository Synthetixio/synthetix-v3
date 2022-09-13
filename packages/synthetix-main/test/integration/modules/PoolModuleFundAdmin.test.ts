import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import hre from 'hardhat';
import { ethers } from 'ethers';

import { bootstrapWithMockMarketAndPool } from '../bootstrap';
import { snapshotCheckpoint } from '../../utils';

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

      await (await systems().Core.connect(owner).registerMarket(MockMarket2.address)).wait();
      await (await systems().Core.connect(owner).registerMarket(MockMarket3.address)).wait();
    });

    const restore = snapshotCheckpoint(provider);

    it('reverts when pool does not exist', async () => {
      await assertRevert(
        systems().Core.connect(user1).setPoolConfiguration(834693286, [1], [1], [0, 0]),
        `PoolNotFound("${834693286}")`,
        systems().Core
      );
    });

    it('reverts when not owner', async () => {
      await assertRevert(
        systems().Core.connect(user2).setPoolConfiguration(poolId, [1], [1], [0, 0]),
        `Unauthorized("${await user2.getAddress()}")`,
        systems().Core
      );
    });

    it('reverts with more weights than markets', async () => {
      await assertRevert(
        systems().Core.connect(owner).setPoolConfiguration(poolId, [1], [1, 2], [0, 0]),
        'InvalidParameters("markets.length,weights.length,maxDebtShareValues.length", "must match")',
        systems().Core
      );
    });

    it('reverts with more markets than weights', async () => {
      await assertRevert(
        systems().Core.connect(owner).setPoolConfiguration(poolId, [1, 2], [1], [0, 0]),
        'InvalidParameters("markets.length,weights.length,maxDebtShareValues.length", "must match")',
        systems().Core
      );
    });

    // in particular, this test needs to go here because we want to see it fail
    // even when there is no liquidity to rebalance
    it('reverts when a marketId does not exist', async () => {
      await assertRevert(
        systems()
          .Core.connect(owner)
          .setPoolConfiguration(poolId, [1, 2, 92197628], [1, 1, 1], [0, 0, 0]),
        'MarketNotFound("92197628")',
        systems().Core
      );
    });

    it('reverts when a marketId is duplicated', async () => {
      await assertRevert(
        systems().Core.connect(owner).setPoolConfiguration(poolId, [1, 1], [1, 1], [0, 0]),
        'InvalidParameters("markets"',
        systems().Core
      );
    });

    it('default configuration sets market collateral', async () => {
      assertBn.equal(
        await systems().Core.connect(owner).getMarketCollateral(marketId()),
        depositAmount
      );
    });

    describe('repeat pool sets position', async () => {
      before(restore);

      before('set pool position', async () => {
        await systems().Core.connect(owner).setPoolConfiguration(poolId, [marketId()], [1], [One]);
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
            .setPoolConfiguration(poolId, [marketId(), marketId2], [1, 3], [One, One]);
        });

        it('returns pool position correctly', async () => {
          assert.deepEqual(await systems().Core.getPoolConfiguration(poolId), [
            [marketId(), ethers.BigNumber.from(marketId2)],
            [ethers.BigNumber.from(1), ethers.BigNumber.from(3)],
            [One, One],
          ]);
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

          describe('exit the markets', () => {
            before('set pool position', async () => {
              await systems().Core.connect(owner).setPoolConfiguration(poolId, [], [], []);
            });

            it('returns pool position correctly', async () => {
              assert.deepEqual(await systems().Core.getPoolConfiguration(poolId), [[], [], []]);
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
          .setPoolConfiguration(
            poolId,
            [marketId()],
            [1],
            [One.mul(One.mul(-1)).div(depositAmount)]
          );
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
          .setPoolConfiguration(
            secondPoolId,
            [marketId()],
            [1],
            [One.mul(One).div(depositAmount).mul(2)]
          );
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
            // should be exactly 201 (market1 99 + market2 2 + 100 deposit)
            assertBn.equal(
              await systems().Core.connect(owner).getWithdrawableUsd(marketId()),
              Hundred.mul(2).add(One)
            );
          });

          it('vault isnt credited because it wasnt bumped early enough', async () => {
            assertBn.equal(
              await systems().Core.callStatic.getVaultDebt(poolId, collateralAddress()),
              0
            );
          });

          describe('and then the market reports 50 balance', () => {
            before('', async () => {
              await MockMarket().connect(user1).setReportedDebt(Hundred.div(2));
            });

            it('has same amount of withdrawable usd', async () => {
              assertBn.equal(
                await systems().Core.connect(owner).getWithdrawableUsd(marketId()),
                Hundred.mul(2).add(One)
              );
            });

            it('vault is debted', async () => {
              // div 2 twice because the vault has half the debt of the pool
              assertBn.equal(
                await systems().Core.callStatic.getVaultDebt(poolId, collateralAddress()),
                Hundred.div(2).div(2)
              );
            });

            const restore = snapshotCheckpoint(provider);

            describe('and then the market reports balance above limit again', () => {
              before(restore);
              // testing the "soft" limit
              before('set market', async () => {
                await MockMarket().connect(user1).setReportedDebt(Hundred.mul(2));
              });

              it('has same amount withdrawable usd + the allowed amount by the vault', async () => {
                assertBn.equal(
                  await systems().Core.connect(owner).getWithdrawableUsd(marketId()),
                  Hundred.mul(2).add(One)
                );
              });

              it('vault assumes expected amount of debt', async () => {
                assertBn.equal(
                  await systems().Core.callStatic.getVaultDebt(poolId, collateralAddress()),
                  Hundred.sub(One)
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
                  Hundred.mul(2).add(One)
                );
              });

              it('vault assumes expected amount of debt', async () => {
                assertBn.equal(
                  await systems().Core.callStatic.getVaultDebt(poolId, collateralAddress()),
                  Hundred.sub(One)
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
        await systems().Core.connect(owner).setPoolConfiguration(poolId, [marketId()], [1], [One]);
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
