import assert from 'assert/strict';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';

import { bootstrapWithMockMarketAndPool } from '../../bootstrap';
import { verifyUsesFeatureFlag } from '../../verifications';

describe('CrossChainPoolModule', function () {
  const { signers, systems } = bootstrapWithMockMarketAndPool();

  let owner: ethers.Signer, user1: ethers.Signer, user2: ethers.Signer;

  before('identify signers', async () => {
    [owner, user1, user2] = signers();
  });

  describe('createCrossChainPool()', () => {
    verifyUsesFeatureFlag(
      () => systems().Core,
      'createCrossChainPool',
      () => systems().Core.connect(user1).createCrossChainPool(1, ethers.constants.AddressZero)
    );

    it('only works for owner', async () => {});

    it('only works if chain does not already have pool id', async () => {});

    describe('successful call', () => {
      it('triggers cross chain call', async () => {});
    });
  });

  describe('_recvCreateCrossChainPool()', () => {
    it('checks that its a cross chain call', async () => {});

    describe('successful call', () => {
      it('mark pool as created with cross chain', async () => {});
    });
  });

  describe('setCrossChainPoolConfiguration()', () => {
    it('only works for owner', async () => {});

    it('is only callable is pool is cross chain', async () => {});

    describe('successful call', () => {
      it('sets local decreasing market capacities', async () => {});

      describe('finish sync', () => {
        it('sets increasing market capacities', async () => {});
      });
    });
  });

  describe('_recvSetCrossChainPoolConfiguration', () => {
    it('checks cross chain', async () => {});

    describe('successful call', () => {
      it('sets local decreasing market capacities', async () => {});

      describe('finish sync', () => {
        it('sets increasing market capacities', async () => {});
      });
    });
  });

  describe('_recvPoolHeartbeat()', () => {
    it('checks cross chain', async () => {});

    describe('successful call', () => {
      it('sets pool sync info', async () => {});

      it('assigns specified debt to vaults', async () => {});

      it('rebalances vault collaterals', async () => {});

      it('emits event', async () => {});
    });
  });

  describe('handleOracleFulfillment()', () => {
    it('checks that its chainlink functions only', async () => {});

    describe('successful call', async () => {
      it('triggers pool heartbeats', async () => {});
    });
  });

  describe('performUpkeep()', () => {
    it('checks that upkeep is necessary', async () => {});

    describe('successful call', async () => {
      it('triggers chainlink functions', async () => {});
    });
  });
});
