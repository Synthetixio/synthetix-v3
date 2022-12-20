import assert from 'node:assert/strict';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';
import { NftModule } from '../../../typechain-types';
import { bootstrap } from '../../bootstrap';

describe('NftModule', function () {
  const { getContract, getSigners } = bootstrap({ implementation: 'NftModuleRouter' });

  let NftModule: NftModule;
  let owner: ethers.Signer;
  let user: ethers.Signer;

  before('identify dependencies', function () {
    [owner, user] = getSigners();
    NftModule = getContract('NftModule');
  });

  describe('initialize()', function () {
    it('reverts when not owner', async function () {
      await assertRevert(
        NftModule.connect(user).initialize('Temp Token', 'TMP', 'ipfs://some-hash'),
        `Unauthorized("${await user.getAddress()}")`
      );
    });

    it('works with owner', async function () {
      await NftModule.connect(owner).initialize('Temp Token', 'TMP', 'ipfs://some-hash');
      assert.equal(await NftModule.isInitialized(), true);
    });
  });
});
