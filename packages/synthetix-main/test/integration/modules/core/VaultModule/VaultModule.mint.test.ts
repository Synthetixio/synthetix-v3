import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';
import { bootstrapWithStakedPool } from '../../../bootstrap';
import Permissions from '../../../mixins/AcccountRBACMixin.permissions';

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

  let mintAmount: ethers.BigNumber;

  describe('VaultModule - Minting and burning', function () {
    before('identify signers', async () => {
      [owner, user1, user2] = signers();
    });

    // Note: The pool is setup by the bootstrapWithStakedPool helper
    describe('when a pool is setup and user1 has deposited and delegated to it', function () {
      it('shows that the user has staked the expected collateral amount', async function () {
        assertBn.equal(
          (await systems().Core.getPositionCollateral(accountId, poolId, collateralAddress()))
            .amount,
          depositAmount
        );
      });

      describe('when an unauthorized user tries to mint', function () {
        it('reverts', async function () {
          await assertRevert(
            systems()
              .Core.connect(user2)
              .mintUsd(accountId, poolId, collateralAddress(), depositAmount.mul(10)),
            `PermissionDenied("1", "${Permissions.MINT}", "${await user2.getAddress()}")`,
            systems().Core
          );
        });
      });

      describe('when a user tries to mint to below c-ratio (150%)', function () {
        it('reverts', async () => {
          await assertRevert(
            systems()
              .Core.connect(user1)
              .mintUsd(accountId, poolId, collateralAddress(), depositAmount), // Would take c-ratio to < 150%
            'InsufficientCollateralRatio',
            systems().Core
          );
        });
      });

      describe('when the user mints snxUSD', function () {
        before('mint', async () => {
          mintAmount = depositAmount.div(10);

          await systems().Core.connect(user1).mintUsd(
            accountId,
            poolId,
            collateralAddress(),
            mintAmount // Should be enough to keep c-ratio >= 150%
          );
        });

        it('shows that the users debt increases exactly by the amount minted', async function () {
          assertBn.equal(
            await systems().Core.callStatic.getPositionDebt(accountId, poolId, collateralAddress()),
            mintAmount
          );
        });

        it('sent the minted snxUSD to the user', async function () {
          assertBn.equal(await systems().USD.balanceOf(await user1.getAddress()), mintAmount);
        });

        describe('when the user mints snxUSD again', function () {
          before('mint', async () => {
            await systems().Core.connect(user1).mintUsd(
              accountId,
              poolId,
              collateralAddress(),
              mintAmount // Should still be enough to keep c-ratio >= 150%
            );
          });

          it('shows that the users debt increases exactly by the amount minted', async function () {
            assertBn.equal(
              await systems().Core.callStatic.getPositionDebt(
                accountId,
                poolId,
                collateralAddress()
              ),
              mintAmount.mul(2)
            );
          });

          it('sent the minted snxUSD to the user', async function () {
            assertBn.equal(
              await systems().USD.balanceOf(await user1.getAddress()),
              mintAmount.mul(2)
            );
          });

          describe('when the user burns snxUSD', function () {
            before('burn', async () => {
              await systems()
                .Core.connect(user1)
                .burnUsd(accountId, poolId, collateralAddress(), mintAmount);
            });

            it('shows that the users debt decreases exactly by the amount burnt', async function () {
              assertBn.equal(
                await systems().Core.callStatic.getPositionDebt(
                  accountId,
                  poolId,
                  collateralAddress()
                ),
                mintAmount
              );
            });

            it('removed the snxUSD from the user', async function () {
              assertBn.equal(await systems().USD.balanceOf(await user1.getAddress()), mintAmount);
            });
          });

          describe('when the user transfers snxUSD to another account', function () {
            before('transfer', async () => {
              await systems()
                .USD.connect(user1)
                .transfer(await user2.getAddress(), mintAmount);
            });

            it('moved the snxUSD', async function () {
              assertBn.equal(await systems().USD.balanceOf(await user1.getAddress()), 0);
              assertBn.equal(await systems().USD.balanceOf(await user2.getAddress()), mintAmount);
            });

            it('shows that the users debt did not change', async function () {
              assertBn.equal(
                await systems().Core.callStatic.getPositionDebt(
                  accountId,
                  poolId,
                  collateralAddress()
                ),
                mintAmount
              );
            });

            describe('when a user burns on behalf of another user', function () {
              before('burn on behalf', async () => {
                await systems()
                  .Core.connect(user2)
                  .burnUsd(accountId, poolId, collateralAddress(), mintAmount);
              });

              it('removed the snxUSD from the second user', async function () {
                assertBn.equal(await systems().USD.balanceOf(await user2.getAddress()), 0);
              });

              it('reduced the original users debt', async function () {
                assertBn.equal(
                  await systems().Core.callStatic.getPositionDebt(
                    accountId,
                    poolId,
                    collateralAddress()
                  ),
                  0
                );
              });
            });
          });
        });
      });
    });
  });
});
