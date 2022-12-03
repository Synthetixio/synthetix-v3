import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';

import { bootstrap } from '../../../bootstrap';

describe('AccountTokenModule', function () {
  const { signers, systems } = bootstrap();

  let user1: ethers.Signer;

  before('identify signers', async () => {
    [, user1] = signers();
  });

  describe('AccountTokenModule - Minting', function () {
    describe('when a user attempts to mint an account token via the account system directly', async function () {
      it('reverts', async function () {
        const { Account } = systems();
        const address = await user1.getAddress();

        await assertRevert(
          Account.connect(user1).mint(address, 1),
          `Unauthorized("${address}")`,
          Account
        );
      });
    });
  });
});
