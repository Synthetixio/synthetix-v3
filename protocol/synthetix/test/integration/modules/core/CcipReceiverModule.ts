import assert from 'assert/strict';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';

import { bootstrap } from '../../bootstrap';
import { verifyUsesFeatureFlag } from '../../verifications';

describe('CrossChainPoolModule', function () {
  const { signers, systems } = bootstrap();

  let owner: ethers.Signer, user1: ethers.Signer, user2: ethers.Signer;

  before('identify signers', async () => {
    [owner, user1, user2] = signers();
  });

  describe('ccipReceive()', () => {
    it('fails if caller is not CCIP router', async () => {

    });

    it('fails if message sender on other chain is not self', async () => {

    });

    it('forwards message to specified caller', async () => {

    });
  });
});
