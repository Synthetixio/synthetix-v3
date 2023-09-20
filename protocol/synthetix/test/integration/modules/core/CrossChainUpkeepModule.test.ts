import { ethers } from 'ethers';

import { bootstrapWithMockMarketAndPool } from '../../bootstrap';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';

describe('CrossChainUpkeepModule', function () {
  const { signers, systems } = bootstrapWithMockMarketAndPool();

  let user1: ethers.Signer;

  before('identify signers', async () => {
    [, user1] = signers();
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
    const requestId = ethers.utils.formatBytes32String('woot');

    before('initiate fake functions call', async () => {});

    it('checks that its chainlink functions only', async () => {
      await assertRevert(
        systems().Core.handleOracleFulfillment(requestId, '0x', '0x'),
        `Unauthorized(${await owner.getAddress()})`,
        systems().Core
      );
    });

    describe('chainlink call failure', async () => {
      it('does nothing', async () => {
        await systems().Core.connect(user1).handleOracleFulfillment(requestId, '0x', '0xfoobar');
      });
    });

    describe('successful call', async () => {
      before('exec', async () => {
        await systems().Core.connect(user1).handleOracleFulfillment(requestId, '0xfoobar', '0x');
      });

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
