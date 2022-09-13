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

  let mintAmount: ethers.BigNumber;

  describe('VaultModule - Leverage', function () {
    before('identify signers', async () => {
      [owner, user1, user2] = signers();
    });

    // Note: The pool is setup by the bootstrapWithStakedPool helper
    describe('when a pool is setup and user1 has deposited and delegated to it', function () {
      describe('when a user tries to delegate with any leverage other than 1', function () {
        it('reverts', async () => {
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

        // These exposure tests should be enabled when exposures other
        // than 1 are allowed (which might be something we want to do)
        describe.skip('when a user increases exposure', function () {});
        describe.skip('when a user reduces exposure', function () {});
      });
    });
  });
});
