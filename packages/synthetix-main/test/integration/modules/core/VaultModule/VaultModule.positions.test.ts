import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { ethers } from 'ethers';
import { bootstrapWithStakedPool } from '../../../bootstrap';

describe.only('VaultModule', function () {
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

  const accountId2 = 283847;

  const ZERO = ethers.utils.parseEther('0');

  function accountHasExpectedCollateral(accountId: number, collateralAmount: ethers.BigNumber) {
    it(`account ${accountId} has expected collateral`, async function () {
      assertBn.equal(
        (await systems().Core.getPositionCollateral(accountId, poolId, collateralAddress())).amount,
        collateralAmount
      );
    });
  }

  function accountHasExpectedDebt(accountId: number, debtAmount: ethers.BigNumber) {
    it(`account ${accountId} has expected debt`, async function () {
      assertBn.equal(
        await systems().Core.callStatic.getPositionDebt(accountId, poolId, collateralAddress()),
        debtAmount
      );
    });
  }

  function systemHasExpectedTotalCollateral(collateralAmount: ethers.BigNumber) {
    it('system has expected total collateral', async function () {
      assertBn.equal(
        (await systems().Core.callStatic.getVaultCollateral(poolId, collateralAddress())).amount,
        collateralAmount
      );
    });
  }

  describe('VaultModule - Multiple users changing their positions', function () {
    before('identify signers', async () => {
      [owner, user1, user2] = signers();
    });

    // Note: The pool is setup by the bootstrapWithStakedPool helper
    describe('when a pool is setup and user1 has deposited and delegated to it', function () {
      before('set up user2', async function () {
        await systems().Core.connect(user2).createAccount(accountId2);

        await collateralContract()
          .connect(user1)
          .transfer(await user2.getAddress(), depositAmount.mul(2));
      });

      it('shows that both users have tokens', async function () {
        assertBn.equal(
          await collateralContract().balanceOf(await user2.getAddress()),
          depositAmount.mul(8)
        );
        assertBn.equal(
          await collateralContract().balanceOf(await user2.getAddress()),
          depositAmount.mul(2)
        );
      });

      accountHasExpectedCollateral(accountId, depositAmount);
      accountHasExpectedDebt(accountId, ZERO);

      accountHasExpectedCollateral(accountId2, ZERO);
      accountHasExpectedDebt(accountId2, ZERO);

      systemHasExpectedTotalCollateral(depositAmount);

      describe('when the second user deposits collateral', function () {
        before('deposit', async function () {
          await collateralContract()
            .connect(user2)
            .approve(systems().Core.address, depositAmount.mul(2));

          await systems()
            .Core.connect(user2)
            .depositCollateral(accountId2, collateralAddress(), depositAmount.mul(2));
        });

        it('shows that the second user has deposited collateral', async function () {
          const totalAvailable = await systems().Core.getAccountAvailableCollateral(
            accountId2,
            collateralContract().address
          );

          assertBn.equal(totalAvailable, depositAmount.mul(2));
        });

        describe('when the second user delegates collateral', function () {
          before('delegate', async function () {
            await systems().Core.connect(user2).delegateCollateral(
              accountId2,
              poolId,
              collateralAddress(),
              depositAmount.div(3), // user1 75%, user2 25%
              ethers.utils.parseEther('1')
            );
          });

          accountHasExpectedCollateral(accountId, depositAmount);
          accountHasExpectedDebt(accountId, ZERO);

          accountHasExpectedCollateral(accountId2, depositAmount.div(3));
          accountHasExpectedDebt(accountId2, ZERO);

          systemHasExpectedTotalCollateral(depositAmount.add(depositAmount.div(3)));

          describe('when the second user mints snxUSD', function () {
            before('mint', async function () {
              await systems().Core.connect(user2).mintUsd(
                accountId2,
                poolId,
                collateralAddress(),
                depositAmount.div(100) // should be enough collateral to mint this
              );
            });

            it('shows that users have expected debt', async function () {});

            accountHasExpectedCollateral(accountId, depositAmount);
            accountHasExpectedDebt(accountId, ZERO);

            accountHasExpectedCollateral(accountId2, depositAmount.div(3));
            accountHasExpectedDebt(accountId2, ZERO);

            systemHasExpectedTotalCollateral(depositAmount.add(depositAmount.div(3)));
          });
        });
      });
    });
  });
});
