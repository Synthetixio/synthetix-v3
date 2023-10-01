import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';

import { bn, bootstrapWithMockMarketAndPool } from '../../bootstrap';

describe.only('OffchainWormholeModule', function () {
  const { owner, signers, systems, staker, accountId, poolId, collateralAddress, MockMarket } =
    bootstrapWithMockMarketAndPool();

  let FakeWormholeSend: ethers.Signer, FakeWormholeReceive: ethers.Signer;
  let FakeCcr: ethers.Contract;
  const fiftyUSD = bn(50);
  const twoHundredUSD = bn(200);

  before('identify signers', async () => {
    [FakeWormholeSend, FakeWormholeReceive] = signers();

    const factory = await hre.ethers.getContractFactory('FakeWormholeCrossChainRead');

    FakeCcr = await factory.connect(owner()).deploy();
  });

  before('set wormhole settings', async () => {
    await systems()
      .Core.connect(owner())
      .configureWormholeCrossChain(
        await FakeWormholeSend.getAddress(),
        await FakeWormholeReceive.getAddress(),
        FakeCcr.address,
        [1, 2, 3, 4, 13370],
        [10, 20, 30, 40, 13370]
      );
  });

  before('get some snxUSD', async () => {
    await systems()
      .Core.connect(staker())
      .mintUsd(accountId, poolId, collateralAddress(), twoHundredUSD);

    await systems().Core.connect(staker()).withdraw(accountId, collateralAddress(), fiftyUSD);
  });

  describe('readCrossChainWormhole()', () => {
    before('set cross chain data', async () => {
      await FakeCcr.setCrossChainData(10, systems().Core.address, '0x12345678', '0x01');
      await FakeCcr.setCrossChainData(20, systems().Core.address, '0x12345678', '0x0202');
      await FakeCcr.setCrossChainData(30, systems().Core.address, '0x12345678', '0x03');
      await FakeCcr.setCrossChainData(40, systems().Core.address, '0x12345678', '0x04');
      await FakeCcr.setCrossChainData(13370, systems().Core.address, '0x12345678', '0x1337');
    });

    it('returns whatever cross chain data from the contract', async () => {
      const responses = await systems().Core.callStatic.readCrossChainWormhole(
        ethers.constants.HashZero, // unused
        [1, 2, 3, 4, 13370],
        '0x12345678',
        0 // unused
      );

      assert(responses.length == 5);
      assert(responses[0] == '0x01');
      assert(responses[1] == '0x0202');
      assert(responses[2] == '0x03');
      assert(responses[3] == '0x04');
      assert(responses[4] == '0x1337');
    });
  });

  describe('sendWormholeMessage()', async () => {
    it('only callable by the core system', async () => {
      await assertRevert(
        systems().Core.sendWormholeMessage([1, 2, 3], '0x12345678', 1234567),
        'Unauthorized(',
        systems().Core
      );
    });
  });

  describe('receiveWormholeMessages()', async () => {
    it('fails if not wormhole sender', async () => {
      await assertRevert(
        systems()
          .Core.connect(FakeWormholeSend)
          .receiveWormholeMessages(
            systems().Core.interface.encodeFunctionData('createAccount()'),
            [],
            ethers.utils.defaultAbiCoder.encode(['address'], [systems().Core.address]),
            10,
            ethers.constants.HashZero
          ),
        'Unauthorized(',
        systems().Core
      );
    });

    it('fails if the cross chain sender is not self', async () => {
      await assertRevert(
        systems()
          .Core.connect(FakeWormholeReceive)
          .receiveWormholeMessages(
            systems().Core.interface.encodeFunctionData('createAccount()'),
            [],
            ethers.utils.defaultAbiCoder.encode(['address'], [await FakeWormholeSend.getAddress()]),
            10,
            ethers.constants.HashZero
          ),
        'Unauthorized(',
        systems().Core
      );
    });

    it('can call a function from cross chain receiver', async () => {
      await assertEvent(
        await systems()
          .Core.connect(FakeWormholeReceive)
          .receiveWormholeMessages(
            systems().Core.interface.encodeFunctionData('registerMarket', [MockMarket().address]),
            [],
            ethers.utils.defaultAbiCoder.encode(['address'], [systems().Core.address]),
            10,
            ethers.constants.HashZero
          ),
        'MarketRegistered(',
        systems().Core
      );
    });
  });
});
