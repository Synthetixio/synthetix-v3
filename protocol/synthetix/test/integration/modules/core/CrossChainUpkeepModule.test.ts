import { ethers } from 'ethers';

import { bootstrapWithMockMarketAndPool } from '../../bootstrap';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';

describe('CrossChainUpkeepModule', function () {
  const { signers, systems, collateralAddress, marketId, owner } = bootstrapWithMockMarketAndPool();

  let user1: ethers.Signer;

  before('identify signers', async () => {
    [, user1] = signers();
  });

  describe.only('_recvPoolHeartbeat()', () => {
    it('checks cross chain', async () => {
      await assertRevert(
        systems().Core._recvPoolHeartbeat(
          1,
          {
            liquidity: 0,
            cumulativeMarketDebt: 0,
            totalDebt: 0,
            dataTimestamp: 0,
            oldestDataTimestamp: 0,
            oldestPoolConfigTimestamp: 0,
          },
          1
        ),
        'Unauthorized(',
        systems().Core
      );
    });

    describe('successful call', () => {
      let txn: ethers.providers.TransactionResponse;
      before('do the call', async () => {
        const call = systems().Core.interface.encodeFunctionData('_recvPoolHeartbeat', [
          1,
          {
            liquidity: 1,
            cumulativeMarketDebt: 2,
            totalDebt: 3,
            dataTimestamp: 4,
            oldestDataTimestamp: 5,
            oldestPoolConfigTimestamp: 6,
          },
          1,
        ]);

        txn = await systems().Core.callSelf(call);
      });
      it('sets pool sync info', async () => {});

      it('assigns specified debt to vaults', async () => {
        assertBn.equal(await systems().Core.callStatic.getVaultDebt(1, collateralAddress()), 1);
      });

      it('rebalances vault collaterals', async () => {
        // check connected market's credit capacity, should have gone down. If so, that means that rebalance occured
        assertBn.equal(
          await systems().Core.getWithdrawableMarketUsd(marketId()),
          ethers.utils.parseEther('1000')
        );
      });

      it('emits event', async () => {
        await assertEvent(txn, `PoolHeartbeat(1`, systems().Core);
      });
    });
  });

  describe('performUpkeep()', () => {
    it('checks that upkeep is necessary', async () => {});

    describe('successful call', async () => {
      it('triggers chainlink functions', async () => {});
    });
  });
});
