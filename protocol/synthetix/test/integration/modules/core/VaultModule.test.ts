import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import assert from 'assert/strict';
import { BigNumber, constants, ethers } from 'ethers';
import hre from 'hardhat';
import { bn, bootstrapWithStakedPool } from '../../bootstrap';
import Permissions from '../../mixins/AccountRBACMixin.permissions';
import { verifyUsesFeatureFlag } from '../../verifications';
import { fastForwardTo, getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { wei } from '@synthetixio/wei';

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
    oracleNodeId,
  } = bootstrapWithStakedPool();

  const MAX_UINT = ethers.constants.MaxUint256;

  let owner: ethers.Signer, user1: ethers.Signer, user2: ethers.Signer;

  let MockMarket: ethers.Contract;
  let marketId: BigNumber;

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

  before('add second collateral type', async () => {
    // add collateral
    await (
      await systems().Core.connect(owner).configureCollateral({
        tokenAddress: systems().Collateral2Mock.address,
        oracleNodeId: oracleNodeId(),
        issuanceRatioD18: '5000000000000000000',
        liquidationRatioD18: '1500000000000000000',
        liquidationRewardD18: '20000000000000000000',
        minDelegationD18: '20000000000000000000',
        depositingEnabled: true,
      })
    ).wait();

    await systems()
      .Core.connect(owner)
      .configureCollateral({
        tokenAddress: await systems().Core.getUsdToken(),
        oracleNodeId: ethers.utils.formatBytes32String(''),
        issuanceRatioD18: bn(1.5),
        liquidationRatioD18: bn(1.1),
        liquidationRewardD18: 0,
        minDelegationD18: 0,
        depositingEnabled: true,
      });
  });

  const restore = snapshotCheckpoint(provider);

  function getExpectedCollateralizationRatio(
    collateralAmount: ethers.BigNumberish,
    debt: ethers.BigNumberish
  ) {
    const debtBN = ethers.BigNumber.from(debt);
    if (debtBN.isZero()) {
      return MAX_UINT;
    }

    const collateralBN = ethers.BigNumber.from(collateralAmount);
    const decimalBN = ethers.BigNumber.from(10).pow(18);

    return collateralBN.mul(decimalBN).div(debtBN);
  }

  // eslint-disable-next-line max-params
  function verifyAccountState(
    accountId: number,
    poolId: number,
    collateralAmount: ethers.BigNumberish,
    debt: ethers.BigNumberish
  ) {
    return async () => {
      assertBn.equal(
        await systems().Core.getPositionCollateral(accountId, poolId, collateralAddress()),
        collateralAmount
      );

      assertBn.equal(
        await systems().Core.callStatic.getPositionDebt(accountId, poolId, collateralAddress()),
        debt
      );
      assertBn.equal(
        await systems().Core.callStatic.getPositionCollateralRatio(
          accountId,
          poolId,
          collateralAddress()
        ),
        getExpectedCollateralizationRatio(collateralAmount, debt)
      );
    };
  }

  describe('fresh vault', async () => {
    const fakeFreshVaultId = 209372;

    before('create empty vault', async () => {
      await systems().Core.createPool(fakeFreshVaultId, await user1.getAddress());
    });

    it('returns 0 debt', async () => {
      assertBn.equal(
        await systems().Core.callStatic.getVaultDebt(fakeFreshVaultId, collateralAddress()),
        0
      );
    });

    it('returns 0 collateral', async () => {
      assertBn.equal(
        (
          await systems().Core.callStatic.getVaultCollateral(fakeFreshVaultId, collateralAddress())
        )[0],
        0
      );
    });

    it('returns 0 collateral ratio', async () => {
      assertBn.equal(
        await systems().Core.callStatic.getVaultCollateralRatio(
          fakeFreshVaultId,
          collateralAddress()
        ),
        0
      );
    });
  });

  describe('delegateCollateral()', async () => {
    it(
      'after bootstrap have correct amounts',
      verifyAccountState(accountId, poolId, depositAmount, 0)
    );

    it('has max cratio', async function () {
      assertBn.equal(
        await systems().Core.callStatic.getPositionCollateralRatio(
          accountId,
          poolId,
          collateralAddress()
        ),
        MAX_UINT
      );
    });

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

    it('fails when new collateral amount equals current collateral amount', async () => {
      await assertRevert(
        systems()
          .Core.connect(user1)
          .delegateCollateral(
            accountId,
            poolId,
            collateralAddress(),
            depositAmount,
            ethers.utils.parseEther('1')
          ),
        'InvalidCollateralAmount()',
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

    verifyUsesFeatureFlag(
      () => systems().Core,
      'delegateCollateral',
      () =>
        systems()
          .Core.connect(user1)
          .delegateCollateral(
            accountId,
            42,
            collateralAddress(),
            depositAmount.div(50),
            ethers.utils.parseEther('1')
          )
    );

    describe('when collateral is disabled by system', async () => {
      const restore = snapshotCheckpoint(provider);
      after(restore);

      const fakeVaultId = 93729028;

      before('create empty vault', async () => {
        await systems().Core.createPool(fakeVaultId, await user1.getAddress());
      });

      before('disable collateral', async () => {
        const beforeConfiguration =
          await systems().Core.getCollateralConfiguration(collateralAddress());

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
              fakeVaultId,
              collateralAddress(),
              depositAmount.div(50),
              ethers.utils.parseEther('1')
            ),
          `CollateralDepositDisabled("${collateralAddress()}")`,
          systems().Core
        );
      });
    });

    describe('when collateral is disabled by pool owner', async () => {
      const restore = snapshotCheckpoint(provider);
      after(restore);

      const fakeVaultId = 93729021;

      before('create empty vault', async () => {
        await systems().Core.createPool(fakeVaultId, await user1.getAddress());
      });

      before('enable collateral for the system', async () => {
        const beforeConfiguration =
          await systems().Core.getCollateralConfiguration(collateralAddress());

        await systems()
          .Core.connect(owner)
          .configureCollateral({ ...beforeConfiguration, depositingEnabled: true });
      });

      // fails when collateral is disabled for the pool by pool owner
      before('disable collateral for the pool by the pool owner', async () => {
        await systems()
          .Core.connect(user1)
          .setPoolCollateralConfiguration(fakeVaultId, collateralAddress(), {
            collateralLimitD18: bn(10),
            issuanceRatioD18: bn(0),
          });
      });

      // fails when collateral is disabled for the pool by pool owner
      it('fails when trying to open delegation position with disabled collateral', async () => {
        await assertRevert(
          systems()
            .Core.connect(user1)
            .delegateCollateral(
              accountId,
              fakeVaultId,
              collateralAddress(),
              depositAmount.div(50),
              ethers.utils.parseEther('1')
            ),
          `PoolCollateralLimitExceeded("${fakeVaultId}", "${collateralAddress()}", "${depositAmount
            .div(50)
            .toString()}", "${bn(10).toString()}")`,
          systems().Core
        );
      });

      it('collateral is enabled by the pool owner', async () => {
        await systems()
          .Core.connect(user1)
          .setPoolCollateralConfiguration(fakeVaultId, collateralAddress(), {
            collateralLimitD18: bn(1000000),
            issuanceRatioD18: bn(0),
          });
      });

      it('the delegation works as expected with the enabled collateral', async () => {
        await systems()
          .Core.connect(user1)
          .delegateCollateral(
            accountId,
            fakeVaultId,
            collateralAddress(),
            depositAmount.div(50),
            ethers.utils.parseEther('1')
          );
      });
    });

    describe('when pool has limited collateral deposit', async () => {
      before('set pool limit', async () => {
        await systems()
          .Core.connect(owner)
          .setPoolCollateralConfiguration(poolId, collateralAddress(), {
            collateralLimitD18: depositAmount.div(2),
            issuanceRatioD18: bn(0),
          });
      });

      it('fails when pool does not allow sufficient deposit amount', async () => {
        await assertRevert(
          systems()
            .Core.connect(user1)
            .delegateCollateral(
              accountId,
              poolId,
              collateralAddress(),
              depositAmount.mul(2),
              ethers.utils.parseEther('1')
            ),
          `PoolCollateralLimitExceeded("${poolId}", "${collateralAddress()}", "${depositAmount
            .mul(2)
            .toString()}", "${depositAmount.div(2).toString()}")`,
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

      it('vault c-ratio is affected', async () => {
        assertBn.equal(
          await systems().Core.callStatic.getVaultCollateralRatio(poolId, collateralAddress()),
          depositAmount.mul(ethers.utils.parseEther('1')).div(startingDebt)
        );
      });

      describe('second user delegates', async () => {
        const user2AccountId = 283847;

        before('set pool limit', async () => {
          await systems()
            .Core.connect(owner)
            .setPoolCollateralConfiguration(poolId, collateralAddress(), {
              collateralLimitD18: depositAmount.mul(10),
              issuanceRatioD18: bn(0),
            });
        });

        before('second user delegates and mints', async () => {
          // user1 has extra collateral available
          await collateralContract()
            .connect(user1)
            .transfer(await user2.getAddress(), depositAmount.mul(2));

          await systems().Core.connect(user2)['createAccount(uint128)'](user2AccountId);

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

          await systems()
            .Core.connect(user2)
            .withdraw(user2AccountId, await systems().Core.getUsdToken(), depositAmount.div(100));
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

        describe('if one of the markets has a min delegation time', () => {
          const restore = snapshotCheckpoint(provider);

          before('set market min delegation time to something high', async () => {
            await MockMarket.setMinDelegationTime(86400);
          });

          describe('without time passing', async () => {
            it('fails when min delegation timeout not elapsed', async () => {
              await assertRevert(
                systems().Core.connect(user2).delegateCollateral(
                  user2AccountId,
                  poolId,
                  collateralAddress(),
                  depositAmount.div(4), // user1 50%, user2 50%
                  ethers.utils.parseEther('1')
                ),
                `MinDelegationTimeoutPending("${poolId}",`,
                systems().Core
              );
            });

            it('can increase delegation without waiting', async () => {
              await systems()
                .Core.connect(user2)
                .delegateCollateral(
                  user2AccountId,
                  poolId,
                  collateralAddress(),
                  depositAmount.mul(2),
                  ethers.utils.parseEther('1')
                );
            });

            after(restore);
          });

          describe('after time passes', () => {
            before('fast forward', async () => {
              // for some reason `fastForward` doesn't seem to work with anvil
              await fastForwardTo((await getTime(provider())) + 86400, provider());
            });

            it('works', async () => {
              await systems()
                .Core.connect(user2)
                .delegateCollateral(
                  user2AccountId,
                  poolId,
                  collateralAddress(),
                  depositAmount.div(2),
                  ethers.utils.parseEther('1')
                );
            });
          });

          after(restore);
        });

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
              const beforeConfiguration =
                await systems().Core.getCollateralConfiguration(collateralAddress());

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
            const { issuanceRatioD18 } =
              await systems().Core.getCollateralConfiguration(collateralAddress());
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
              const beforeConfiguration =
                await systems().Core.getCollateralConfiguration(collateralAddress());

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
              .USD.connect(user2)
              .approve(systems().Core.address, constants.MaxUint256.toString());

            await systems()
              .Core.connect(user2)
              .deposit(user2AccountId, await systems().Core.getUsdToken(), depositAmount.div(100));

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

  describe('distribution chain edge cases', async () => {
    beforeEach(restore);
    it('edge case: double USD printing on market by not fully flushing with 2 collaterals', async () => {
      const startingWithdrawable = await systems().Core.getWithdrawableMarketUsd(marketId);

      assertBn.gt(startingWithdrawable, 0);

      // first, mint max debt
      await MockMarket.withdrawUsd(startingWithdrawable);

      // sanity
      assertBn.equal(await systems().Core.getWithdrawableMarketUsd(marketId), 0);

      // next flush and rebalance (these methods are both write despite appearance)
      await systems().Core.getVaultDebt(poolId, systems().Collateral2Mock.address);
      await systems().Core.getVaultDebt(poolId, systems().Collateral2Mock.address);

      // finally, we shouldn't be able to mint
      await assertRevert(
        MockMarket.withdrawUsd(wei(1).toBN()),
        'NotEnoughLiquidity(',
        systems().Core
      );

      assertBn.equal(await systems().Core.getWithdrawableMarketUsd(marketId), 0);
    });

    it('edge case: double USD printing on market by not fully flushing with `rebalancePool`', async () => {
      const startingWithdrawable = await systems().Core.getWithdrawableMarketUsd(marketId);

      assertBn.gt(startingWithdrawable, 0);

      // first, mint max debt
      await MockMarket.withdrawUsd(startingWithdrawable);

      // sanity
      assertBn.equal(await systems().Core.getWithdrawableMarketUsd(marketId), 0);

      // next flush and rebalance
      // two rebalancePool() required because the debt is accumulated on first call, but not actually assumed by market
      // further rebalancePool() calls have no effect, but another call to `withdrawUsd()` can be made and then this repeated.
      // NOTE: this attack could also be executed in a pool which has 2 vaults. Just sync only one of the vaults, and the debt from
      // the other unsynced vault will not have its debt updated. so the security issue is not exclusive to being
      // caused by the addition of this function, just more convenient
      await systems().Core.rebalancePool(poolId, ethers.constants.AddressZero);
      await systems().Core.rebalancePool(poolId, ethers.constants.AddressZero);

      // finally, we shouldn't be able to mint
      await assertRevert(
        MockMarket.withdrawUsd(wei(1).toBN()),
        'NotEnoughLiquidity(',
        systems().Core
      );

      assertBn.equal(await systems().Core.getWithdrawableMarketUsd(marketId), 0);
    });
  });
});
