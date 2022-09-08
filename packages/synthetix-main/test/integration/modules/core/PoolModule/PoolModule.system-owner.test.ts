import assert from 'assert/strict';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers as Ethers } from 'ethers';
import { bootstrap } from '../../../bootstrap';

describe('PoolModule', function () {
  const { signers, systems } = bootstrap();

  let owner: Ethers.Signer, user1: Ethers.Signer;

  let receipt: Ethers.providers.TransactionReceipt;

  describe('PoolModule - System owner actions', function () {
    before('identify signers', async () => {
      [owner, user1] = signers();
    });

    describe('when a non system owner attempts to set the minimum liquidity ratio', function () {
      it('reverts', async () => {
        assertRevert(
          systems().Core.connect(user1).setMinLiquidityRatio(Ethers.utils.parseEther('2')),
          'Unauthorized',
          systems().Core
        );
      });
    });

    describe('when the system owner sets the minimum liquidity ratio', function () {
      before('set minimum liquidity ratio', async () => {
        await systems().Core.connect(owner).setMinLiquidityRatio(Ethers.utils.parseEther('2'));
      });

      it('shows that the value is set', async () => {
        assertBn.equal(await systems().Core.getMinLiquidityRatio(), Ethers.utils.parseEther('2'));
      });
    });
  });
});
