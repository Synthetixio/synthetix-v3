import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';

import { bootstrap } from '../../bootstrap';

describe('CcipReceiverModule', function () {
  const { signers, systems } = bootstrap();

  let owner: ethers.Signer, FakeCcip: ethers.Signer;

  before('identify signers', async () => {
    [owner, , , FakeCcip] = signers();
  });

  before('set ccip settings', async () => {
    await systems()
      .Core.connect(owner)
      .configureChainlinkCrossChain(
        await FakeCcip.getAddress(),
        ethers.constants.AddressZero,
        ethers.constants.AddressZero
      );

    await systems().Core.connect(owner).setSupportedCrossChainNetworks([1234, 5678], [1234, 5678]);
  });

  describe('ccipReceive()', () => {
    it('fails if caller is not CCIP router', async () => {
      await assertRevert(
        systems().Core.ccipReceive({
          messageId: ethers.constants.HashZero,
          sourceChainId: 1234,
          sender: ethers.utils.defaultAbiCoder.encode(['address'], [systems().Core.address]),
          data: '0x',
          tokenAmounts: [],
        }),
        `NotCcipRouter("${await owner.getAddress()}")`,
        systems().Core
      );
    });

    it('fails if chain is not supported', async () => {
      await assertRevert(
        systems()
          .Core.connect(FakeCcip)
          .ccipReceive({
            messageId: ethers.constants.HashZero,
            sourceChainId: 1111,
            sender: ethers.utils.defaultAbiCoder.encode(['address'], [systems().Core.address]),
            data: '0x',
            tokenAmounts: [],
          }),
        `UnsupportedNetwork("0")`,
        systems().Core
      );
    });

    it('fails if message sender on other chain is not self', async () => {
      await assertRevert(
        systems()
          .Core.connect(FakeCcip)
          .ccipReceive({
            messageId: ethers.constants.HashZero,
            sourceChainId: 1234,
            sender: ethers.utils.defaultAbiCoder.encode(['address'], [await FakeCcip.getAddress()]),
            data: '0x',
            tokenAmounts: [],
          }),
        'Unauthorized(',
        systems().Core
      );
    });
  });
});
