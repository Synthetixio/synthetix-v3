import assertRevert from '@synthetixio/core-js/dist/utils/assertions/assert-revert';
import { bootstrap, bootstrapWithStakedFund } from '../bootstrap';
import assertBn from '@synthetixio/core-js/dist/utils/assertions/assert-bignumber';
import { ethers } from 'ethers';

describe('VaultModule', function () {
  const { 
    signers, 
    systems,
    accountId,
    fundId,
    depositAmount,
    collateralContract,
    collateralAddress,
    restore
  } = bootstrapWithStakedFund();

  let owner: ethers.Signer, user1: ethers.Signer, user2: ethers.Signer;

  before('identify signers', async () => {
    [owner, user1, user2] = signers();
  });

  function verifyAccountState(accountId: number, fundId: number, collateralAmount: ethers.BigNumberish, debt: ethers.BigNumberish) {
    return async () => {
      assertBn.equal((await systems().Core.accountVaultCollateral(accountId, fundId, collateralAddress())).amount, collateralAmount);
      assertBn.equal((await systems().Core.callStatic.accountVaultDebt(accountId, fundId, collateralAddress())), debt);
    }
  }

  describe('delegateCollateral()', async () => {

    it('after bootstrap have correct amounts', verifyAccountState(accountId, fundId, depositAmount, 0));

    it('verifies permission for account', async () => {
      assertRevert(
        systems().Core.connect(user2).delegateCollateral(
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
        systems().Core.connect(user2).delegateCollateral(
          accountId,
          fundId,
          collateralAddress(),
          depositAmount.mul(2),
          ethers.utils.parseEther('1.1')
        ),
        `InvalidLeverage`,
        systems().Core
      );
    });

    it('user1 has expected initial position', verifyAccountState(accountId, fundId, depositAmount, 0));

    describe('second user delegates', async () => {
      const user2AccountId = 283847;

      before('second user delegates and mints', async () => {
        // user1 has extra collateral available
        await collateralContract().connect(user1).transfer(await user2.getAddress(), depositAmount.mul(2));

        await systems().Core.connect(user2).createAccount(user2AccountId);

        await collateralContract().connect(user2).approve(systems().Core.address, depositAmount.mul(2));

        await systems().Core.connect(user2).stake(user2AccountId, collateralAddress(), depositAmount.mul(2));
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

      it('user1 still has correct position', verifyAccountState(accountId, fundId, depositAmount, 0));
      it('user2 still has correct position', verifyAccountState(user2AccountId, fundId, depositAmount.div(3), depositAmount.div(100)));


      // these exposure tests should be enabled when exposures other than 1 are allowed (which might be something we want to do)
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

        it('user1 still has correct position', verifyAccountState(accountId, fundId, depositAmount, 0));
        it('user2 still has correct position', verifyAccountState(user2AccountId, fundId, depositAmount.div(3), depositAmount.div(100)));
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

        it('user1 still has correct position', verifyAccountState(accountId, fundId, depositAmount, 0));
        it('user2 still has correct position', verifyAccountState(user2AccountId, fundId, depositAmount.div(3), depositAmount.div(100)));
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
            systems().Core.connect(user2).delegateCollateral(
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
  
          it('user1 still has correct position', verifyAccountState(accountId, fundId, depositAmount, 0));
          it('user2 position is increased', verifyAccountState(user2AccountId, fundId, depositAmount, depositAmount.div(100)));
        });
      });

      describe('decrease collateral', async () => {
        it('fails when insufficient c-ratio', async () => {
          assertRevert(
            systems().Core.connect(user2).delegateCollateral(
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
            await systems().Core.connect(user2).delegateCollateral(
              user2AccountId,
              fundId,
              collateralAddress(),
              depositAmount.div(10),
              ethers.utils.parseEther('1')
            );
          });
  
          it('user1 still has correct position', verifyAccountState(accountId, fundId, depositAmount, 0));
          it('user2 position is decreased', verifyAccountState(user2AccountId, fundId, depositAmount.div(10), depositAmount.div(100)));
        });
      });

      describe('remove collateral', async () => {
        before('repay debt', async () => {
          await systems().Core.connect(user2).burnUSD(
            user2AccountId,
            fundId,
            collateralAddress(),
            depositAmount.div(100)
          );
        });

        before('delegate', async () => {
          await systems().Core.connect(user2).delegateCollateral(
            user2AccountId,
            fundId,
            collateralAddress(),
            0,
            ethers.utils.parseEther('1')
          );
        });

        it('user1 still has correct position', verifyAccountState(accountId, fundId, depositAmount, 0));
        it('user2 position is closed', verifyAccountState(user2AccountId, fundId, 0, 0));
      });
    });

    describe('first user leaves', async () => {
      // now the pool is empty


    });
  });

  describe('mintUSD()', async () => {
    before(restore);
    it('verifies permission for account', async () => {
      assertRevert(
        systems().Core.connect(user2).mintUSD(
          accountId,
          fundId,
          collateralAddress(),
          depositAmount.mul(10)
        ),
        `Unauthorized("${await user2.getAddress()}")`,
        systems().Core
      );
    });

    it('verifies sufficient c-ratio', async () => {
      assertRevert(
        systems().Core.connect(user1).mintUSD(
          accountId,
          fundId,
          collateralAddress(),
          depositAmount
        ),
        `InsufficientCollateralRatio`,
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
        )
      });

      it('has correct debt', verifyAccountState(accountId, fundId, depositAmount, depositAmount.div(10)));

      it('sent USD to user1', async () => {
        assertBn.equal(await systems().USD.balanceOf(await user1.getAddress()), depositAmount.div(10));
      });

      describe('subsequent mint', () => {
        before('mint again', async () => {
          await systems().Core.connect(user1).mintUSD(
            accountId,
            fundId,
            collateralAddress(),
            depositAmount.div(10) // should be enough
          )
        });

        it('has correct debt', verifyAccountState(accountId, fundId, depositAmount, depositAmount.div(5)));

        it('sent more USD to user1', async () => {
          assertBn.equal(await systems().USD.balanceOf(await user1.getAddress()), depositAmount.div(5));
        });
      });
    });
  });

  describe('burnUSD()', async () => {
    before(restore);
    before('mint', async () => {
      await systems().Core.connect(user1).mintUSD(
        accountId,
        fundId,
        collateralAddress(),
        depositAmount.div(10)
      )
    });


    describe('burn from other account', async () => {
      before('transfer burn collateral', async () => {
        // send the collateral to account 2 so it can burn on behalf
        await systems().USD.connect(user1).transfer(await user2.getAddress(), depositAmount.div(10));
      });

      before('other account burn', async () => {
        await systems().Core.connect(user2).burnUSD(
          accountId,
          fundId,
          collateralAddress(),
          depositAmount.div(10)
        );
      });

      it('has correct debt', verifyAccountState(accountId, fundId, depositAmount, 0));

      it('took away from user2', async () => {
        assertBn.equal(await systems().USD.balanceOf(await user2.getAddress()), 0);
      });
    });
  });
});