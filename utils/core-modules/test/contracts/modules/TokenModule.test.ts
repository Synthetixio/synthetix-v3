import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';
import { TokenModule } from '../../../typechain-types';
import { bootstrap } from '../../bootstrap';

describe('TokenModule', function () {
  const { getContractBehindProxy, getSigners } = bootstrap({
    implementation: 'TokenModuleRouter',
  });

  let TokenModule: TokenModule;
  let userMint: ethers.Signer;
  let userBurn: ethers.Signer;

  before('identify signers', function () {
    [, userMint, userBurn] = getSigners();
  });

  before('identify modules', async function () {
    TokenModule = getContractBehindProxy('TokenModule');
  });

  describe('mint()', function () {
    it('reverts when not owner', async function () {
      await assertRevert(
        TokenModule.connect(userMint).mint(await userMint.getAddress(), 42),
        `Unauthorized("${await userMint.getAddress()}")`
      );
    });

    it('mints', async function () {
      await TokenModule.mint(await userMint.getAddress(), 42);
      assertBn.equal(await TokenModule.balanceOf(await userMint.getAddress()), 42);
    });
  });

  describe('burn()', function () {
    before(async function () {
      await TokenModule.mint(await userBurn.getAddress(), 42);
    });

    it('reverts when not owner', async function () {
      await assertRevert(
        TokenModule.connect(userBurn).burn(await userBurn.getAddress(), 21),
        `Unauthorized("${await userBurn.getAddress()}")`
      );
    });

    it('burns', async function () {
      await TokenModule.burn(await userBurn.getAddress(), 21);
      assertBn.equal(await TokenModule.balanceOf(await userBurn.getAddress()), 21);
    });
  });
});
