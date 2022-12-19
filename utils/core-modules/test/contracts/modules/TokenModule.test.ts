import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';
import { TokenModule } from '../../../typechain-types';
import { bootstrap } from '../../bootstrap';

describe('TokenModule', () => {
  const { getContract, getSigners } = bootstrap();

  let TokenModule: TokenModule;
  let userMint: ethers.Signer;
  let userBurn: ethers.Signer;

  before('identify signers', () => {
    [, userMint, userBurn] = getSigners();
  });

  before('identify modules', () => {
    const TokenModuleProxy = getContract('TokenModuleProxy');
    TokenModule = getContract('TokenModule', TokenModuleProxy.address) as TokenModule;
  });

  describe('mint()', () => {
    it('reverts when not owner', async () => {
      await assertRevert(
        TokenModule.connect(userMint).mint(await userMint.getAddress(), 42),
        `Unauthorized("${await userMint.getAddress()}")`
      );
    });

    it('mints', async () => {
      await TokenModule.mint(await userMint.getAddress(), 42);
      assertBn.equal(await TokenModule.balanceOf(await userMint.getAddress()), 42);
    });
  });

  describe('burn()', () => {
    before(async () => {
      await TokenModule.mint(await userBurn.getAddress(), 42);
    });

    it('reverts when not owner', async () => {
      await assertRevert(
        TokenModule.connect(userBurn).burn(await userBurn.getAddress(), 21),
        `Unauthorized("${await userBurn.getAddress()}")`
      );
    });

    it('burns', async () => {
      await TokenModule.burn(await userBurn.getAddress(), 21);
      assertBn.equal(await TokenModule.balanceOf(await userBurn.getAddress()), 21);
    });
  });
});
