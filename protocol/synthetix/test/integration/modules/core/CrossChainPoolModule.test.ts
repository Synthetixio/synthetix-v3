import { ethers } from 'ethers';

import { bootstrapWithMockMarketAndPool } from '../../bootstrap';
import { verifyUsesFeatureFlag } from '../../verifications';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';

import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';

describe.only('CrossChainPoolModule', function () {
  const { owner, signers, systems, provider, MockMarket, poolId } =
    bootstrapWithMockMarketAndPool();

  let user1: ethers.Signer, FakeWormholeSend: ethers.Signer, FakeWormholeReceive: ethers.Signer;
  let FakeCcr: ethers.Contract;
  //const fiftyUSD = bn(50);
  //const twoHundredUSD = bn(200);

  before('identify signers', async () => {
    [, user1, FakeWormholeSend, FakeWormholeReceive] = signers();

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

  before('set test pool to use wormhole', async () => {
    await systems()
      .Core.connect(owner())
      .setCrossChainPoolSelectors(
        poolId,
        systems().Core.interface.getSighash('readCrossChainWormhole'),
        systems().Core.interface.getSighash('sendCrossChainFake')
      );
  });

  const restoreWithReadyPool = snapshotCheckpoint(provider);

  // before('get some snxUSD', async () => {
  //   await systems()
  //     .Core.connect(staker())
  //     .mintUsd(accountId, poolId, collateralAddress(), twoHundredUSD);
  //
  //   await systems().Core.connect(staker()).withdraw(accountId, collateralAddress(), fiftyUSD);
  // });

  describe('createCrossChainPool()', () => {
    before(restoreWithReadyPool);
    verifyUsesFeatureFlag(
      () => systems().Core,
      'createCrossChainPool',
      () => systems().Core.connect(user1).createCrossChainPool(1, ethers.constants.AddressZero)
    );

    it('only works for owner', async () => {
      await assertRevert(
        systems().Core.connect(user1).createCrossChainPool(1, 2),
        'Unauthorized(',
        systems().Core
      );
    });

    describe('successful call', () => {
      it('triggers cross chain call', async () => {
        await systems().Core.connect(owner()).createCrossChainPool(1, 2);
      });

      it('does not work a second time  because pool already created', async () => {
        await assertRevert(
          systems().Core.connect(owner()).createCrossChainPool(1, 2),
          'PoolAlreadyExists(2,',
          systems().Core
        );
      });
    });
  });

  describe('_recvCreateCrossChainPool()', () => {
    before(restoreWithReadyPool);
    it('checks that its a cross chain call', async () => {
      await assertRevert(
        systems().Core._recvCreateCrossChainPool(13370, 1),
        'Unauthorized(',
        systems().Core
      );
    });

    describe('successful call', () => {
      it('mark pool as created with cross chain', async () => {});
    });
  });

  describe('setCrossChainPoolConfiguration()', () => {
    before(restoreWithReadyPool);

    it('is only callable is pool is cross chain', async () => {
      await assertRevert(
        systems().Core.connect(owner()).setCrossChainPoolConfiguration(1, []),
        'PoolNotCrossChain(',
        systems().Core
      );
    });

    describe('when cross chain pool', async () => {
      before('make the pool cross chain', async () => {
        await systems().Core.connect(owner()).createCrossChainPool(1, 2);
      });
      it('only works for owner', async () => {
        await assertRevert(
          systems().Core.connect(user1).setCrossChainPoolConfiguration(1, []),
          'Unauthorized(',
          systems().Core
        );
      });

      describe('successful call', () => {
        it('sets local decreasing market capacities', async () => {});

        describe('finish sync', () => {
          it('sets increasing market capacities', async () => {});
        });
      });
    });
  });

  describe('_recvSetCrossChainPoolConfiguration', () => {
    before(restoreWithReadyPool);
    before('make the pool cross chain', async () => {
      await systems().Core.connect(owner()).createCrossChainPool(1, 2);
    });
    it('checks cross chain', async () => {
      await assertRevert(
        systems().Core._recvSetCrossChainPoolConfiguration(1, [], 0, 0),
        'Unauthorized(',
        systems().Core
      );
    });

    describe('successful call', () => {
      it('sets local decreasing market capacities', async () => {});

      describe('finish sync', () => {
        it('sets increasing market capacities', async () => {});
      });
    });
  });
});
