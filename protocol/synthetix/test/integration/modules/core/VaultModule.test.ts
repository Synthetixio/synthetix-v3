import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import hre from 'hardhat';
import { ethers } from 'ethers';
import Permissions from '../../mixins/AccountRBACMixin.permissions';
import { bootstrapWithStakedPool } from '../../bootstrap';
import { snapshotCheckpoint } from '../../../utils/snapshot';

describe('VaultModule', function () {
  const {
    signers,
    systems,
    provider,
    accountId,
    poolId,
    depositAmount,
    collateralContract,
    collateralAddress,
  } = bootstrapWithStakedPool();

  let owner: ethers.Signer, user1: ethers.Signer, user2: ethers.Signer;

  let MockMarket: ethers.Contract;
  let marketId: number;

  before('identify signers', async () => {
    [owner, user1, user2] = signers();
  });

  before('give user1 permission to register market', async () => {
    await systems()
      .Core.connect(owner)
      .addToFeatureFlagAllowlist(
        ethers.utils.formatBytes32String('registerMarket'),
        await user1.getAddress()
      );
  });

  before('deploy and connect fake market', async () => {
    const factory = await hre.ethers.getContractFactory('MockMarket');

    MockMarket = await factory.connect(owner).deploy();

    marketId = await systems().Core.connect(user1).callStatic.registerMarket(MockMarket.address);

    await systems().Core.connect(user1).registerMarket(MockMarket.address);

    await MockMarket.connect(owner).initialize(
      systems().Core.address,
      marketId,
      ethers.utils.parseEther('1')
    );

    await systems()
      .Core.connect(owner)
      .setPoolConfiguration(poolId, [
        {
          marketId: marketId,
          weightD18: ethers.utils.parseEther('1'),
          maxDebtShareValueD18: ethers.utils.parseEther('10000000000000000'),
        },
      ]);
  });

  const restore = snapshotCheckpoint(provider);

  // eslint-disable-next-line max-params
  function verifyAccountState(
    accountId: number,
    poolId: number,
    collateralAmount: ethers.BigNumberish,
    debt: ethers.BigNumberish
  ) {
    return async () => {
      assertBn.equal(
        (await systems().Core.getPositionCollateral(accountId, poolId, collateralAddress())).amount,
        collateralAmount
      );
      assertBn.equal(
        await systems().Core.callStatic.getPositionDebt(accountId, poolId, collateralAddress()),
        debt
      );
    };
  }

  describe('fresh vault', async () => {
    it('returns 0 debt', async () => {
      assertBn.equal(await systems().Core.callStatic.getVaultDebt(0, collateralAddress()), 0);
    });

    it('returns 0 collateral', async () => {
      assertBn.equal(
        (await systems().Core.callStatic.getVaultCollateral(0, collateralAddress()))[0],
        0
      );
    });

    it('returns 0 collateral ratio', async () => {
      assertBn.equal(
        await systems().Core.callStatic.getVaultCollateralRatio(0, collateralAddress()),
        0
      );
    });
  });

  describe('delegateCollateral()', async () => {
    it(
      'after bootstrap have correct amounts',
      verifyAccountState(accountId, poolId, depositAmount, 0)
    );

    it('after bootstrap liquidity is delegated all the way back to the market', async () => {
      assertBn.gt(await systems().Core.callStatic.getMarketCollateral(marketId), 0);
    });

    it('verifies permission for account', async () => {
      await assertRevert(
        systems()
          .Core.connect(user2)
          .delegateCollateral(
            accountId,
            poolId,
            collateralAddress(),
            depositAmount.mul(2),
            ethers.utils.parseEther('1')
          ),
        `PermissionDenied("1", "${Permissions.DELEGATE}", "${await user2.getAddress()}")`,
        systems().Core
      );
    });

    it('verifies leverage', async () => {
      const leverage = ethers.utils.parseEther('1.1');
      await assertRevert(
        systems()
          .Core.connect(user1)
          .delegateCollateral(
            accountId,
            poolId,
            collateralAddress(),
            depositAmount.mul(2),
            leverage
          ),
        `InvalidLeverage("${leverage}")`,
        systems().Core
      );
    });

    it('fails when trying to delegate less than minDelegation amount', async () => {
      await assertRevert(
        systems().Core.connect(user1).delegateCollateral(
          accountId,
          0, // 0 pool is just easy way to test another pool
          collateralAddress(),
          depositAmount.div(51),
          ethers.utils.parseEther('1')
        ),
        'InsufficientDelegation("20000000000000000000")',
        systems().Core
      );
    });

    it('fails when pool does not exist', async () => {
      await assertRevert(
        systems()
          .Core.connect(user1)
          .delegateCollateral(
            accountId,
            42,
            collateralAddress(),
            depositAmount.div(50),
            ethers.utils.parseEther('1')
          ),
        'PoolNotFound("42")',
        systems().Core
      );
    });

    describe('when collateral is disabled', async () => {
      const restore = snapshotCheckpoint(provider);
      after(restore);

      before('disable collatearal', async () => {
        const beforeConfiguration = await systems().Core.getCollateralConfiguration(
          collateralAddress()
        );

        await systems()
          .Core.connect(owner)
          .configureCollateral({ ...beforeConfiguration, depositingEnabled: false });
      });

      it('fails when trying to open delegation position with disabled collateral', async () => {
        await assertRevert(
          systems()
            .Core.connect(user1)
            .delegateCollateral(
              accountId,
              0,
              collateralAddress(),
              depositAmount.div(50),
              ethers.utils.parseEther('1')
            ),
          `CollateralDepositDisabled("${collateralAddress()}")`,
          systems().Core
        );
      });
    });

    it(
      'user1 has expected initial position',
      verifyAccountState(accountId, poolId, depositAmount, 0)
    );

    describe('market debt accumulation', () => {
      const startingDebt = ethers.utils.parseEther('100');

      before('user1 goes into debt', async () => {
        await MockMarket.connect(user1).setReportedDebt(startingDebt);
      });

      it('has allocated debt to vault', async () => {
        assertBn.equal(
          await systems().Core.connect(user2).callStatic.getVaultDebt(poolId, collateralAddress()),
          startingDebt
        );
      });

      it(
        'user1 has become indebted',
        verifyAccountState(accountId, poolId, depositAmount, startingDebt)
      );

      describe('second user delegates', async () => {
        const user2AccountId = 283847;

        before('second user delegates and mints', async () => {
          // user1 has extra collateral available
          await collateralContract()
            .connect(user1)
            .transfer(await user2.getAddress(), depositAmount.mul(2));

          await systems().Core.connect(user2).createAccount(user2AccountId);

          await collateralContract()
            .connect(user2)
            .approve(systems().Core.address, depositAmount.mul(2));

          await systems()
            .Core.connect(user2)
            .deposit(user2AccountId, collateralAddress(), depositAmount.mul(2));

          await systems().Core.connect(user2).delegateCollateral(
            user2AccountId,
            poolId,
            collateralAddress(),
            depositAmount.div(3), // user1 75%, user2 25%
            ethers.utils.parseEther('1')
          );

          await systems().Core.connect(user2).mintUsd(
            user2AccountId,
            poolId,
            collateralAddress(),
            depositAmount.div(100) // should be enough collateral to mint this
          );
        });

        // lock enough collateral that the market will *become* capacity locked when the user
        // withdraws
        const locked = ethers.utils.parseEther('1400');

        // NOTE: if you are looking at this block and wondering if it would affect your test,
        // this is to ensure all below cases are covered with locking.
        // when position is increased, it should not be affected by locking
        // when a position is decreased, it should only be allowed if the capacity does
        // not become locked
        before('market locks some capacity', async () => {
          await MockMarket.setLocked(locked);
        });

        it(
          'user1 still has correct position',
          verifyAccountState(accountId, poolId, depositAmount, startingDebt)
        );
        it(
          'user2 still has correct position',
          verifyAccountState(user2AccountId, poolId, depositAmount.div(3), depositAmount.div(100))
        );

        // these exposure tests should be enabled when exposures other
        // than 1 are allowed (which might be something we want to do)
        describe.skip('increase exposure', async () => {
          before('delegate', async () => {
            await systems().Core.connect(user2).delegateCollateral(
              user2AccountId,
              poolId,
              collateralAddress(),
              depositAmount.div(3), // user1 50%, user2 50%
              ethers.utils.parseEther('1')
            );
          });

          it(
            'user1 still has correct position',
            verifyAccountState(accountId, poolId, depositAmount, 0)
          );
          it(
            'user2 still has correct position',
            verifyAccountState(user2AccountId, poolId, depositAmount.div(3), depositAmount.div(100))
          );
        });

        describe.skip('reduce exposure', async () => {
          before('delegate', async () => {
            await systems().Core.connect(user2).delegateCollateral(
              user2AccountId,
              poolId,
              collateralAddress(),
              depositAmount.div(3), // user1 50%, user2 50%
              ethers.utils.parseEther('1')
            );
          });

          it(
            'user1 still has correct position',
            verifyAccountState(accountId, poolId, depositAmount, startingDebt)
          );
          it(
            'user2 still has correct position',
            verifyAccountState(user2AccountId, poolId, depositAmount.div(3), depositAmount.div(100))
          );
        });

        describe('remove exposure', async () => {
          before('delegate', async () => {
            await systems().Core.connect(user2).delegateCollateral(
              user2AccountId,
              poolId,
              collateralAddress(),
              depositAmount.div(3), // user1 50%, user2 50%
              ethers.utils.parseEther('1')
            );
          });
        });

        describe('increase collateral', async () => {
          it('fails when not enough available collateral in account', async () => {
            const wanted = depositAmount.mul(3);
            const missing = wanted.sub(depositAmount.div(3));

            await assertRevert(
              systems()
                .Core.connect(user2)
                .delegateCollateral(
                  user2AccountId,
                  poolId,
                  collateralAddress(),
                  wanted,
                  ethers.utils.parseEther('1')
                ),
              `InsufficientAccountCollateral("${missing}")`,
              systems().Core
            );
          });

          describe('when collateral is disabled', async () => {
            const restore = snapshotCheckpoint(provider);
            after(restore);

            before('disable collatearal', async () => {
              const beforeConfiguration = await systems().Core.getCollateralConfiguration(
                collateralAddress()
              );

              await systems()
                .Core.connect(owner)
                .configureCollateral({ ...beforeConfiguration, depositingEnabled: false });
            });

            it('fails when trying to open delegation position with disabled collateral', async () => {
              await assertRevert(
                systems().Core.connect(user2).delegateCollateral(
                  user2AccountId,
                  0,
                  collateralAddress(),
                  depositAmount, // user1 50%, user2 50%
                  ethers.utils.parseEther('1')
                ),
                `CollateralDepositDisabled("${collateralAddress()}")`,
                systems().Core
              );
            });
          });

          describe('success', () => {
            before('delegate', async () => {
              await systems().Core.connect(user2).delegateCollateral(
                user2AccountId,
                poolId,
                collateralAddress(),
                depositAmount, // user1 50%, user2 50%
                ethers.utils.parseEther('1')
              );
            });

            it(
              'user1 still has correct position',
              verifyAccountState(accountId, poolId, depositAmount, startingDebt)
            );
            it(
              'user2 position is increased',
              verifyAccountState(user2AccountId, poolId, depositAmount, depositAmount.div(100))
            );
          });
        });

        describe('decrease collateral', async () => {
          it('fails when insufficient c-ratio', async () => {
            const { issuanceRatioD18 } = await systems().Core.getCollateralConfiguration(
              collateralAddress()
            );
            const price = await systems().Core.getCollateralPrice(collateralAddress());
            const deposit = depositAmount.div(50);
            const debt = depositAmount.div(100);

            await assertRevert(
              systems()
                .Core.connect(user2)
                .delegateCollateral(
                  user2AccountId,
                  poolId,
                  collateralAddress(),
                  depositAmount.div(50),
                  ethers.utils.parseEther('1')
                ),
              `InsufficientCollateralRatio("${deposit}", "${debt}", "${deposit
                .mul(price)
                .div(debt)}", "${issuanceRatioD18}")`,
              systems().Core
            );
          });

          it('fails when reducing to below minDelegation amount', async () => {
            await assertRevert(
              systems()
                .Core.connect(user2)
                .delegateCollateral(
                  user2AccountId,
                  poolId,
                  collateralAddress(),
                  depositAmount.div(51),
                  ethers.utils.parseEther('1')
                ),
              'InsufficientDelegation("20000000000000000000")',
              systems().Core
            );
          });

          it('fails when market becomes capacity locked', async () => {
            // sanity
            assert.ok(
              !(await systems().Core.connect(user2).callStatic.isMarketCapacityLocked(marketId))
            );

            await assertRevert(
              systems()
                .Core.connect(user2)
                .delegateCollateral(
                  user2AccountId,
                  poolId,
                  collateralAddress(),
                  depositAmount.div(10),
                  ethers.utils.parseEther('1')
                ),
              `CapacityLocked("${marketId}")`,
              systems().Core
            );

            // allow future tests to work without being locked
            await MockMarket.setLocked(ethers.utils.parseEther('500'));
          });

          describe('when collateral is disabled', async () => {
            const restore = snapshotCheckpoint(provider);
            after(restore);

            before('disable collateral', async () => {
              const beforeConfiguration = await systems().Core.getCollateralConfiguration(
                collateralAddress()
              );

              await systems()
                .Core.connect(owner)
                .configureCollateral({ ...beforeConfiguration, depositingEnabled: false });
            });

            describe('success', () => {
              before('delegate', async () => {
                await systems()
                  .Core.connect(user2)
                  .delegateCollateral(
                    user2AccountId,
                    poolId,
                    collateralAddress(),
                    depositAmount.div(10),
                    ethers.utils.parseEther('1')
                  );
              });

              it(
                'user1 still has correct position',
                verifyAccountState(accountId, poolId, depositAmount, startingDebt)
              );
              it(
                'user2 position is decreased',
                verifyAccountState(
                  user2AccountId,
                  poolId,
                  depositAmount.div(10),
                  depositAmount.div(100)
                )
              );
            });
          });
        });

        describe('remove collateral', async () => {
          before('repay debt', async () => {
            await systems()
              .Core.connect(user2)
              .burnUsd(user2AccountId, poolId, collateralAddress(), depositAmount.div(100));
          });

          before('delegate', async () => {
            await systems()
              .Core.connect(user2)
              .delegateCollateral(
                user2AccountId,
                poolId,
                collateralAddress(),
                0,
                ethers.utils.parseEther('1')
              );
          });

          it(
            'user1 still has correct position',
            verifyAccountState(accountId, poolId, depositAmount, startingDebt)
          );
          it('user2 position is closed', verifyAccountState(user2AccountId, poolId, 0, 0));

          it('lets user2 re-stake again', async () => {
            await systems().Core.connect(user2).delegateCollateral(
              user2AccountId,
              poolId,
              collateralAddress(),
              depositAmount.div(3), // user1 75%, user2 25%
              ethers.utils.parseEther('1')
            );
          });
        });
      });
    });

    // TODO: also test that user can pull outstanding USD out of position with 0 collateral

    describe('first user leaves', async () => {
      before(restore);
      before('erase debt', async () => {
        await MockMarket.connect(user1).setReportedDebt(0);
      });

      before('undelegate', async () => {
        await systems()
          .Core.connect(user1)
          .delegateCollateral(
            accountId,
            poolId,
            collateralAddress(),
            0,
            ethers.utils.parseEther('1')
          );
      });

      // now the pool is empty
      it('exited user1 position', verifyAccountState(accountId, poolId, 0, 0));

      it('vault is empty', async () => {
        assertBn.equal(
          (await systems().Core.callStatic.getVaultCollateral(poolId, collateralAddress())).amount,
          0
        );
        assertBn.equal(
          await systems().Core.callStatic.getVaultDebt(poolId, collateralAddress()),
          0
        );
      });
    });
  });
});
