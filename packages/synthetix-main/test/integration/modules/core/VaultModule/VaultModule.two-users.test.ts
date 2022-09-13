import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
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

  const accountId2 = () => 283847;

  let depositAmount2: ethers.BigNumber;

  describe('VaultModule - Multiple users changing their positions', function () {
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

      describe('when a second user has collateral', function () {
        before('create user2 account', async function () {
          await systems().Core.connect(user2).createAccount(accountId2());
        });

        before('get collateral', async function () {
          depositAmount2 = depositAmount.mul(2);

          await collateralContract()
            .connect(user1)
            .transfer(await user2.getAddress(), depositAmount2);
        });

        it('shows that the second user has collateral tokens', async function () {
          it('sent the minted snxUSD to the user', async function () {
            assertBn.equal(
              await collateralContract().balanceOf(await user1.getAddress()),
              depositAmount2
            );
          });
        });

        describe('when the second user deposits collateral', function () {
          before('deposit collateral', async function () {
            await collateralContract()
              .connect(user2)
              .approve(systems().Core.address, depositAmount2);

            await systems()
              .Core.connect(user2)
              .depositCollateral(accountId2(), collateralAddress(), depositAmount2);
          });

          it('shows that the second user has deposited collateral', async function () {
            const totalAvailable = await systems().Core.getAccountAvailableCollateral(
              accountId2(),
              collateralContract().address
            );

            assertBn.equal(totalAvailable, depositAmount2);
          });

          // before('delegate collateral', async function () {});
        });
      });
    });
  });
});
