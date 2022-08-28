import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';
import { bootstrap } from '../bootstrap';
import { FakeContract, smock } from '@defi-wonderland/smock';

describe.only('AccountRBACMixin', function () {
  const { signers, systems, provider } = bootstrap();

  let user1: ethers.Signer;
  let user2: ethers.Signer;

  let fakeSystem: FakeContract;

  describe('AccountRBACMixin', function () {
    before('identify signers', async () => {
      [, user1, user2] = signers();
    });

    before('smock system', async function () {
      fakeSystem = await smock.fake('CollateralModule');

      fakeSystem.stake.returns('woof');
    });

    it('dummy', async function () {
      console.log('dummy test');

      const tx = await fakeSystem.connect(user1).stake();
      const receipt = await tx.wait();
      console.log(receipt);
    });
  });
});
