/* eslint-disable @typescript-eslint/ban-ts-comment */

import assert from 'assert/strict';
import { bootstrap } from '../../bootstrap';
import { ethers } from 'ethers';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import hre from 'hardhat';

describe('MulticallModule', function () {
  const { systems, signers } = bootstrap();

  let owner: ethers.Signer, user1: ethers.Signer;

  before('identify signers', async () => {
    [owner, user1] = signers();
  });

  describe('multicall()', () => {
    it('passes through errors', async () => {
      await assertRevert(
        systems()
          .Core.connect(user1)
          .multicall([
            systems().Core.interface.encodeFunctionData('createAccount(uint128)', [
              '170141183460469231731687303715884105727',
            ]),
          ]),
        `InvalidAccountId("170141183460469231731687303715884105727")`,
        systems().Core
      );
    });

    describe('on success', async () => {
      before('call', async () => {
        await systems()
          .Core.connect(user1)
          .multicall([
            systems().Core.interface.encodeFunctionData('createAccount(uint128)', [1234421]),
            systems().Core.interface.encodeFunctionData('createAccount(uint128)', [1234422]),
            systems().Core.interface.encodeFunctionData('createAccount(uint128)', [1234423]),
            systems().Core.interface.encodeFunctionData('createAccount(uint128)', [1234424]),
          ]);
      });

      it('creates all the accounts', async () => {
        assert.equal(await systems().Account.ownerOf(1234421), await user1.getAddress());
        assert.equal(await systems().Account.ownerOf(1234422), await user1.getAddress());
        assert.equal(await systems().Account.ownerOf(1234423), await user1.getAddress());
        assert.equal(await systems().Account.ownerOf(1234424), await user1.getAddress());
      });
    });
  });
});
