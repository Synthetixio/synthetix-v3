import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';

import { bootstrap } from '../../bootstrap';

describe.only('CcipReceiverModule', function () {
  const { signers, systems } = bootstrap();

  let owner: ethers.Signer, user1: ethers.Signer, user2: ethers.Signer, FakeCcip: ethers.Signer;

  before('identify signers', async () => {
    [owner, user1, user2, FakeCcip] = signers();
  });

  before('set ccip settings', async () => {
    await systems()
      .Core.connect(owner)
      .configureChainlinkCrossChain(await FakeCcip.getAddress(), ethers.constants.AddressZero, ethers.constants.AddressZero);
  });

  describe('ccipReceive()', () => {
    it('fails if caller is not CCIP router', async () => {
      await assertRevert(
        systems().Core.ccipReceive({
          messageId: ethers.constants.HashZero,
          sourceChainId: 0,
          sender: ethers.utils.defaultAbiCoder.encode(['address'], [systems().Core.address]),
          data: '0x',
          tokenAmounts: [],
        }),
        `NotCcipRouter("${await owner.getAddress()}")`,
        systems().Core
      );
    });

    it('fails if message sender on other chain is not self', async () => {
      await assertRevert(
        systems().Core.connect(FakeCcip).ccipReceive({
          messageId: ethers.constants.HashZero,
          sourceChainId: 0,
          sender: ethers.utils.defaultAbiCoder.encode(['address'], [await FakeCcip.getAddress()]),
          data: '0x',
          tokenAmounts: [],
        }),
        'Unauthorized(',
        systems().Core
      );
    });

    it('forwards message to specified caller', async () => {
      const tx = await systems().Core.connect(FakeCcip).ccipReceive({
        messageId: ethers.constants.HashZero,
        sourceChainId: 0,
        sender: ethers.utils.defaultAbiCoder.encode(['address'], [systems().Core.address]),
        data: systems().Core.interface.encodeFunctionData('_recvCreateCrossChainPool', [100,5]),
        tokenAmounts: [],
      });

      //console.log(await tx.wait());

      await assertEvent(tx, 'CrossChainSecondaryPoolCreated(', systems().Core);
    });
  });
});
