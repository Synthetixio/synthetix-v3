import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import hre from 'hardhat';
import { ethers } from 'ethers';
import Permissions from '../../storage/AcccountRBACMixin.permissions';
import { bootstrapWithStakedPool } from '../../bootstrap';
import { snapshotCheckpoint } from '../../../utils';

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
      .addToFeatureFlag(ethers.utils.formatBytes32String('market'), await user1.getAddress());
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
      .setPoolConfiguration(
        poolId,
        [marketId],
        [ethers.utils.parseEther('1')],
        [ethers.utils.parseEther('10000000000000000')]
      );
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
        `PermissionDenied(1, "${Permissions.DELEGATE}", "${await user2.getAddress()}")`,
        systems().Core
      );
    });

    it('verifies leverage', async () => {
      await assertRevert(
        systems()
          .Core.connect(user1)
          .delegateCollateral(
            accountId,
            poolId,
            collateralAddress(),
            depositAmount.mul(2),
            ethers.utils.parseEther('1.1')
          ),
        'InvalidLeverage',
        systems().Core
      );
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
            .depositCollateral(user2AccountId, collateralAddress(), depositAmount.mul(2));

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
              collateralAddress,
              depositAmount.div(3), // user1 50%, user2 50%
              ethers.utils.parseEther('1')
            );
          });
        });

        describe('increase collateral', async () => {
          it('fails when not enough available collateral in account', async () => {
            await assertRevert(
              systems()
                .Core.connect(user2)
                .delegateCollateral(
                  user2AccountId,
                  poolId,
                  collateralAddress(),
                  depositAmount.mul(3),
                  ethers.utils.parseEther('1')
                ),
              'InsufficientAccountCollateral',
              systems().Core
            );
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
            await assertRevert(
              systems()
                .Core.connect(user2)
                .delegateCollateral(
                  user2AccountId,
                  poolId,
                  collateralAddress(),
                  depositAmount.div(100),
                  ethers.utils.parseEther('1')
                ),
              'InsufficientCollateralRatio',
              systems().Core
            );
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

  describe('mintUsd()', async () => {
    before(restore);
    it('verifies permission for account', async () => {
      await assertRevert(
        systems()
          .Core.connect(user2)
          .mintUsd(accountId, poolId, collateralAddress(), depositAmount.mul(10)),
        `PermissionDenied(1, "${Permissions.MINT}", "${await user2.getAddress()}")`,
        systems().Core
      );
    });

    it('verifies sufficient c-ratio', async () => {
      await assertRevert(
        systems()
          .Core.connect(user1)
          .mintUsd(accountId, poolId, collateralAddress(), depositAmount),
        'InsufficientCollateralRatio',
        systems().Core
      );
    });

    describe('successful mint', () => {
      before('mint', async () => {
        await systems().Core.connect(user1).mintUsd(
          accountId,
          poolId,
          collateralAddress(),
          depositAmount.div(10) // should be enough
        );
      });

      it(
        'has correct debt',
        verifyAccountState(accountId, poolId, depositAmount, depositAmount.div(10))
      );

      it('sent USD to user1', async () => {
        assertBn.equal(
          await systems().USD.balanceOf(await user1.getAddress()),
          depositAmount.div(10)
        );
      });

      describe('subsequent mint', () => {
        before('mint again', async () => {
          await systems().Core.connect(user1).mintUsd(
            accountId,
            poolId,
            collateralAddress(),
            depositAmount.div(10) // should be enough
          );
        });

        it(
          'has correct debt',
          verifyAccountState(accountId, poolId, depositAmount, depositAmount.div(5))
        );

        it('sent more USD to user1', async () => {
          assertBn.equal(
            await systems().USD.balanceOf(await user1.getAddress()),
            depositAmount.div(5)
          );
        });
      });
    });
  });

  describe('burnUSD()', async () => {
    before(restore);
    before('mint', async () => {
      await systems()
        .Core.connect(user1)
        .mintUsd(accountId, poolId, collateralAddress(), depositAmount.div(10));
    });

    describe('burn from other account', async () => {
      before('transfer burn collateral', async () => {
        // send the collateral to account 2 so it can burn on behalf
        await systems()
          .USD.connect(user1)
          .transfer(await user2.getAddress(), depositAmount.div(10));
      });

      before('other account burn', async () => {
        await systems()
          .Core.connect(user2)
          .burnUsd(accountId, poolId, collateralAddress(), depositAmount.div(10));
      });

      it('has correct debt', verifyAccountState(accountId, poolId, depositAmount, 0));

      it('took away from user2', async () => {
        assertBn.equal(await systems().USD.balanceOf(await user2.getAddress()), 0);
      });
    });
  });
});
