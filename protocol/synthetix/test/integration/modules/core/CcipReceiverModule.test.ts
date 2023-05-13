import assert from 'assert/strict';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';

import { bootstrap } from '../../bootstrap';
import { verifyUsesFeatureFlag } from '../../verifications';

describe('CrossChainPoolModule', function () {
  const { signers, systems } = bootstrap();

  let owner: ethers.Signer, user1: ethers.Signer, user2: ethers.Signer, FakeCcip: ethers.Signer;

  before('identify signers', async () => {
    [owner, user1, user2, FakeCcip] = signers();
  });

  before('set ccip settings', async () => {
    await systems().Core.connect(owner).configureChainlinkCrossChain(await FakeCcip.getAddress(), ethers.constants.AddressZero);
  });

  describe('ccipReceive()', () => {
    it('fails if caller is not CCIP router', async () => {
      await assertRevert(
        systems().Core.ccipReceive({ messageId: '', sourceChainId: 0, sender: systems().Core.address, data: '0x', tokenAmounts: []}),
        'Unauthorized(',
        systems().Core
      );
    });

    it('fails if message sender on other chain is not self', async () => {
      await assertRevert(
        systems().Core.ccipReceive({ messageId: '', sourceChainId: 0, sender: await FakeCcip.getAddress(), data: '0x', tokenAmounts: []}),
        'Unauthorized(',
        systems().Core
      );
    });

    it('forwards message to specified caller', async () => {
      const tx = await systems().Core.ccipReceive({
        messageId: '', 
        sourceChainId: 0, 
        sender: systems().Core.address, 
        data: systems().Core.interface.encodeFunctionData('createAccount(uint128)', [8273846]), 
        tokenAmounts: []
      });

      await assertEvent(
        tx,
        'AccountCreated("8273846")',
        systems().Core
      );
    });
  });
});
