import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import hre from 'hardhat';
import { ethers } from 'ethers';

import { bootstrapWithStakedFund } from '../bootstrap';
import { snapshotCheckpoint } from '../../utils';

describe.skip('VaultModule', function () {
  const {
    signers,
    systems,
    provider,
    accountId,
    fundId,
    depositAmount,
    collateralContract,
    collateralAddress,
  } = bootstrapWithStakedFund();

  let owner: ethers.Signer, user1: ethers.Signer, user2: ethers.Signer;

  let MockMarket: ethers.Contract;
  let marketId: number;

  before('identify signers', async () => {
    [owner, user1, user2] = signers();
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
      .setFundPosition(
        fundId,
        [marketId],
        [ethers.utils.parseEther('1')],
        [ethers.utils.parseEther('10000000')]
      );
  });

  const restore = snapshotCheckpoint(provider);

  // eslint-disable-next-line max-params
  function verifyAccountState(
    accountId: number,
    fundId: number,
    collateralAmount: ethers.BigNumberish,
    debt: ethers.BigNumberish
  ) {
    return async () => {
      assertBn.equal(
        (await systems().Core.accountVaultCollateral(accountId, fundId, collateralAddress()))
          .amount,
        collateralAmount
      );
      assertBn.equal(
        await systems().Core.callStatic.accountVaultDebt(accountId, fundId, collateralAddress()),
        debt
      );
    };
  }

  describe('delegateCollateral()', async () => {
    it(
      'after bootstrap have correct amounts',
      verifyAccountState(accountId, fundId, depositAmount, 0)
    );

    it('after bootstrap liquidity is delegated all the way back to the market', async () => {
      assertBn.gt(await systems().Core.callStatic.marketLiquidity(marketId), 0);
    });

    it('verifies permission for account', async () => {
      assertRevert(
        systems()
          .Core.connect(user2)
          .delegateCollateral(
            accountId,
            fundId,
            collateralAddress(),
            depositAmount.mul(2),
            ethers.utils.parseEther('1')
          ),
        `Unauthorized("${await user2.getAddress()}")`,
        systems().Core
      );
    });

    it('verifies leverage', async () => {
      assertRevert(
        systems()
          .Core.connect(user2)
          .delegateCollateral(
            accountId,
            fundId,
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
      verifyAccountState(accountId, fundId, depositAmount, 0)
    );

    describe('market debt accumulation', () => {
      const startingDebt = ethers.utils.parseEther('100');

      before('user1 goes into debt', async () => {
        await MockMarket.connect(user1).setBalance(startingDebt);
      });

      it('has allocated debt to vault', async () => {
        assertBn.equal(
          await systems().Core.connect(user2).callStatic.vaultDebt(fundId, collateralAddress()),
          startingDebt
        );
      });

      it(
        'user1 has become indebted',
        verifyAccountState(accountId, fundId, depositAmount, startingDebt)
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
            .stake(user2AccountId, collateralAddress(), depositAmount.mul(2));
          await systems().Core.connect(user2).delegateCollateral(
            user2AccountId,
            fundId,
            collateralAddress(),
            depositAmount.div(3), // user1 75%, user2 25%
            ethers.utils.parseEther('1')
          );

          await systems().Core.connect(user2).mintUSD(
            user2AccountId,
            fundId,
            collateralAddress(),
            depositAmount.div(100) // should be enough collateral to mint this
          );
        });

        it(
          'user1 still has correct position',
          verifyAccountState(accountId, fundId, depositAmount, startingDebt)
        );
        it(
          'user2 still has correct position',
          verifyAccountState(user2AccountId, fundId, depositAmount.div(3), depositAmount.div(100))
        );

        // these exposure tests should be enabled when exposures other than 1 are
        // allowed(which might be something we want to do)
        describe.skip('increase exposure', async () => {
          before('delegate', async () => {
            await systems().Core.connect(user2).delegateCollateral(
              user2AccountId,
              fundId,
              collateralAddress,
              depositAmount.div(3), // user1 50%, user2 50%
              ethers.utils.parseEther('1')
            );
          });

          it(
            'user1 still has correct position',
            verifyAccountState(accountId, fundId, depositAmount, 0)
          );
          it(
            'user2 still has correct position',
            verifyAccountState(user2AccountId, fundId, depositAmount.div(3), depositAmount.div(100))
          );
        });

        describe.skip('reduce exposure', async () => {
          before('delegate', async () => {
            await systems().Core.connect(user2).delegateCollateral(
              user2AccountId,
              fundId,
              collateralAddress,
              depositAmount.div(3), // user1 50%, user2 50%
              ethers.utils.parseEther('1')
            );
          });

          it(
            'user1 still has correct position',
            verifyAccountState(accountId, fundId, depositAmount, startingDebt)
          );
          it(
            'user2 still has correct position',
            verifyAccountState(user2AccountId, fundId, depositAmount.div(3), depositAmount.div(100))
          );
        });

        describe.skip('remove exposure', async () => {
          before('delegate', async () => {
            await systems().Core.connect(user2).delegateCollateral(
              user2AccountId,
              fundId,
              collateralAddress,
              depositAmount.div(3), // user1 50%, user2 50%
              ethers.utils.parseEther('1')
            );
          });
        });

        describe('increase collateral', async () => {
          it('fails when not enough available collateral in account', async () => {
            assertRevert(
              systems()
                .Core.connect(user2)
                .delegateCollateral(
                  user2AccountId,
                  fundId,
                  collateralAddress(),
                  depositAmount.mul(3),
                  ethers.utils.parseEther('1')
                ),
              'InsufficientAvailableCollateral',
              systems().Core
            );
          });

          describe('success', () => {
            before('delegate', async () => {
              await systems().Core.connect(user2).delegateCollateral(
                user2AccountId,
                fundId,
                collateralAddress(),
                depositAmount, // user1 50%, user2 50%
                ethers.utils.parseEther('1')
              );
            });

            it(
              'user1 still has correct position',
              verifyAccountState(accountId, fundId, depositAmount, startingDebt)
            );
            it(
              'user2 position is increased',
              verifyAccountState(user2AccountId, fundId, depositAmount, depositAmount.div(100))
            );
          });
        });

        describe('decrease collateral', async () => {
          it('fails when insufficient c-ratio', async () => {
            assertRevert(
              systems()
                .Core.connect(user2)
                .delegateCollateral(
                  user2AccountId,
                  fundId,
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
                  fundId,
                  collateralAddress(),
                  depositAmount.div(10),
                  ethers.utils.parseEther('1')
                );
            });

            it(
              'user1 still has correct position',
              verifyAccountState(accountId, fundId, depositAmount, startingDebt)
            );
            it(
              'user2 position is decreased',
              verifyAccountState(
                user2AccountId,
                fundId,
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
              .burnUSD(user2AccountId, fundId, collateralAddress(), depositAmount.div(100));
          });

          before('delegate', async () => {
            await systems()
              .Core.connect(user2)
              .delegateCollateral(
                user2AccountId,
                fundId,
                collateralAddress(),
                0,
                ethers.utils.parseEther('1')
              );
          });

          it(
            'user1 still has correct position',
            verifyAccountState(accountId, fundId, depositAmount, startingDebt)
          );
          it('user2 position is closed', verifyAccountState(user2AccountId, fundId, 0, 0));

          it('lets user2 re-stake again', async () => {
            await systems().Core.connect(user2).delegateCollateral(
              user2AccountId,
              fundId,
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
        await MockMarket.connect(user1).setBalance(-100);
      });

      before('undelegate', async () => {
        await systems()
          .Core.connect(user1)
          .delegateCollateral(
            accountId,
            fundId,
            collateralAddress(),
            0,
            ethers.utils.parseEther('1')
          );
      });

      // now the pool is empty
      it('exited user1 position', verifyAccountState(accountId, fundId, 0, 0));

      it('vault is empty', async () => {
        assertBn.equal(
          (await systems().Core.callStatic.vaultCollateral(fundId, collateralAddress())).amount,
          0
        );
        assertBn.equal(await systems().Core.callStatic.vaultDebt(fundId, collateralAddress()), 0);
      });
    });
  });

  describe('mintUSD()', async () => {
    before(restore);
    it('verifies permission for account', async () => {
      assertRevert(
        systems()
          .Core.connect(user2)
          .mintUSD(accountId, fundId, collateralAddress(), depositAmount.mul(10)),
        `Unauthorized("${await user2.getAddress()}")`,
        systems().Core
      );
    });

    it('verifies sufficient c-ratio', async () => {
      assertRevert(
        systems()
          .Core.connect(user1)
          .mintUSD(accountId, fundId, collateralAddress(), depositAmount),
        'InsufficientCollateralRatio',
        systems().Core
      );
    });

    describe('successful mint', () => {
      before('mint', async () => {
        await systems().Core.connect(user1).mintUSD(
          accountId,
          fundId,
          collateralAddress(),
          depositAmount.div(10) // should be enough
        );
      });

      it(
        'has correct debt',
        verifyAccountState(accountId, fundId, depositAmount, depositAmount.div(10))
      );

      it('sent USD to user1', async () => {
        assertBn.equal(
          await systems().USD.balanceOf(await user1.getAddress()),
          depositAmount.div(10)
        );
      });

      describe('subsequent mint', () => {
        before('mint again', async () => {
          await systems().Core.connect(user1).mintUSD(
            accountId,
            fundId,
            collateralAddress(),
            depositAmount.div(10) // should be enough
          );
        });

        it(
          'has correct debt',
          verifyAccountState(accountId, fundId, depositAmount, depositAmount.div(5))
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
        .mintUSD(accountId, fundId, collateralAddress(), depositAmount.div(10));
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
          .burnUSD(accountId, fundId, collateralAddress(), depositAmount.div(10));
      });

      it('has correct debt', verifyAccountState(accountId, fundId, depositAmount, 0));

      it('took away from user2', async () => {
        assertBn.equal(await systems().USD.balanceOf(await user2.getAddress()), 0);
      });
    });
  });
});
