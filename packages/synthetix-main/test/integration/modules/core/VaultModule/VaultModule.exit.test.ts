import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { ethers } from 'ethers';
import { bootstrapWithStakedPool } from '../../../bootstrap';

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

  let mintAmount: ethers.BigNumber;

  describe('VaultModule - Entering and exiting a pool', function () {
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

      it('shows that the vault has collateral', async function () {
        assertBn.equal(
          (await systems().Core.callStatic.getVaultCollateral(poolId, collateralAddress())).amount,
          depositAmount
        );
      });

      describe('when user1 exits the vault', function () {
        before('undelegate', async function () {
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

        it('shows that the user no longer has staked collateral', async function () {
          assertBn.equal(
            (await systems().Core.getPositionCollateral(accountId, poolId, collateralAddress()))
              .amount,
            0
          );
        });

        it('shows that the vault no longer has collateral', async function () {
          assertBn.equal(
            (await systems().Core.callStatic.getVaultCollateral(poolId, collateralAddress()))
              .amount,
            0
          );
        });
      });
    });
  });
});
