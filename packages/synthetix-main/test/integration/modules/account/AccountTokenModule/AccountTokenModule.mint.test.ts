import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';
import { bootstrap } from '../../../bootstrap';

describe.only('AccountTokenModule', function () {
  const { signers, systems } = bootstrap();

  let user1: ethers.Signer;

  before('identify signers', async () => {
    [, user1] = signers();
  });

  describe('AccountTokenModule - Minting', function () {
    describe('when a user attempts to mint an account token via the account system directly', async function () {
      it('reverts', async function () {
        await assertRevert(
          systems()
            .Account.connect(user1)
            .mint(await user1.getAddress(), 1),
          `Unauthorized("${await user1.getAddress()}")`,
          systems().Account
        );
      });
    });
  });
});
