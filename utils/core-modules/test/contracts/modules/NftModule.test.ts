import assert from 'node:assert/strict';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';
import { NftModule } from '../../../typechain-types';
import { bootstrap } from '../../bootstrap';

describe('NftModule', function () {
  const { getContractBehindProxy, getSigners } = bootstrap({
    implementation: 'NftModuleRouter',
  });

  let NftModule: NftModule;
  let owner: ethers.Signer;
  let user: ethers.Signer;

  before('identify dependencies', function () {
    [owner, user] = getSigners();
    NftModule = getContractBehindProxy('NftModule');
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

  describe('mint()', () => {
    it('only allows owner to call', async () => {
      await assertRevert(
        NftModule.connect(user).mint(await user.getAddress(), 12341234),
        'Unauthorized(',
        NftModule
      );
    });
  });

  describe('safeMint()', () => {
    it('only allows owner to call', async () => {
      await assertRevert(
        NftModule.connect(user).safeMint(await user.getAddress(), 12341234, '0x'),
        'Unauthorized(',
        NftModule
      );
    });
  });

  describe('burn()', () => {
    it('only allows owner to call', async () => {
      await assertRevert(NftModule.connect(user).burn(12341234), 'Unauthorized(', NftModule);
    });
  });

  describe('setBaseTokenURI()', () => {
    it('successfully persists', async () => {
      const newBaseUri = 'ipfs://mynewbaseuri';
      await NftModule.connect(owner).setBaseTokenURI(newBaseUri);
      await NftModule.connect(owner).mint(await user.getAddress(), 1);
      assert.equal(await NftModule.tokenURI(1), newBaseUri + '1');
    });

    it('only allows the owner to call', async () => {
      await assertRevert(
        NftModule.connect(user).setBaseTokenURI('ipfs://icantsetit'),
        'Unauthorized(',
        NftModule
      );
    });
  });
});
