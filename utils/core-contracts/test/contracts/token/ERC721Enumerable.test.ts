import assert from 'node:assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { ethers } from 'ethers';
import hre from 'hardhat';
import { ERC721EnumerableMock } from '../../../typechain-types';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';

describe('ERC721Enumerable', function () {
  let ERC721Enumerable: ERC721EnumerableMock;

  let user1: ethers.Signer;
  let user2: ethers.Signer;
  let user3: ethers.Signer;

  before('identify signers', async function () {
    [user1, user2, user3] = await hre.ethers.getSigners();
  });

  beforeEach('deploy the contract', async function () {
    const factory = await hre.ethers.getContractFactory('ERC721EnumerableMock');
    ERC721Enumerable = await factory.deploy();
    const tx = await ERC721Enumerable.initialize('Synthetix NFT', 'snxNFT', '');
    await tx.wait();
  });

  describe('interfaces', function () {
    it('implements ERC721', async function () {
      assert.equal(await ERC721Enumerable.supportsInterface(0x80ac58cd as unknown as string), true);
    });

    it('implements ERC721Enumerable', async function () {
      assert.equal(await ERC721Enumerable.supportsInterface(0x780e9d63 as unknown as string), true);
    });

    it('does not implement a random interface', async function () {
      assert.equal(
        await ERC721Enumerable.supportsInterface(0x11223344 as unknown as string),
        false
      );
    });
  });

  describe('mint', function () {
    beforeEach('mint some tokens', async () => {
      await ERC721Enumerable.mintTo(await user1.getAddress(), 100);
      await ERC721Enumerable.mintTo(await user1.getAddress(), 101);
      await ERC721Enumerable.mintTo(await user2.getAddress(), 200);
      await ERC721Enumerable.mintTo(await user2.getAddress(), 201);
    });

    it('properly attribute to user', async function () {
      assertBn.equal(await ERC721Enumerable.tokenOfOwnerByIndex(await user1.getAddress(), 0), 100);
      assertBn.equal(await ERC721Enumerable.tokenOfOwnerByIndex(await user1.getAddress(), 1), 101);
      assertBn.equal(await ERC721Enumerable.tokenOfOwnerByIndex(await user2.getAddress(), 0), 200);
    });

    it('reverts if going past the total supply of tokens', async () => {
      await assertRevert(
        ERC721Enumerable.tokenOfOwnerByIndex(await user1.getAddress(), 2),
        'IndexOverrun("2", "2")',
        ERC721Enumerable
      );
    });
  });

  describe('burn', function () {
    it('properly removes token from user mapping', async function () {
      await ERC721Enumerable.mintTo(await user1.getAddress(), 300);
      await ERC721Enumerable.mintTo(await user1.getAddress(), 301);
      await ERC721Enumerable.burn(301);

      assertBn.equal(await ERC721Enumerable.tokenOfOwnerByIndex(await user1.getAddress(), 0), 300);
      await assertRevert(
        ERC721Enumerable.tokenOfOwnerByIndex(await user1.getAddress(), 1),
        'IndexOverrun("1", "1")',
        ERC721Enumerable
      );
    });
  });

  describe('transfer', function () {
    it('properly removes token from user mapping', async function () {
      await ERC721Enumerable.mintTo(await user1.getAddress(), 400);
      await ERC721Enumerable.mintTo(await user1.getAddress(), 401);
      await ERC721Enumerable.transfer(await user1.getAddress(), await user2.getAddress(), 401);

      assertBn.equal(await ERC721Enumerable.tokenOfOwnerByIndex(await user1.getAddress(), 0), 400);
      assertBn.equal(await ERC721Enumerable.tokenOfOwnerByIndex(await user2.getAddress(), 0), 401);
      await assertRevert(
        ERC721Enumerable.tokenOfOwnerByIndex(await user1.getAddress(), 1),
        'IndexOverrun("1", "1")',
        ERC721Enumerable
      );
    });
  });

  describe('totalSupply', function () {
    beforeEach('mint supply', async () => {
      await ERC721Enumerable.mintTo(await user1.getAddress(), 400);
      await ERC721Enumerable.mintTo(await user1.getAddress(), 401);
      await ERC721Enumerable.mintTo(await user2.getAddress(), 402);
      await ERC721Enumerable.mintTo(await user2.getAddress(), 403);
      await ERC721Enumerable.mintTo(await user3.getAddress(), 404);
      await ERC721Enumerable.mintTo(await user3.getAddress(), 405);

      // sanity
      assertBn.equal(await ERC721Enumerable.totalSupply(), 6);
    });

    it('shows correct nft count', async function () {
      assertBn.equal(await ERC721Enumerable.tokenByIndex(0), 400);
      assertBn.equal(await ERC721Enumerable.tokenByIndex(5), 405);
    });

    it('reverts if going past the total supply of tokens', async () => {
      await assertRevert(
        ERC721Enumerable.tokenByIndex(6),
        'IndexOverrun("6", "6")',
        ERC721Enumerable
      );
    });
  });
});
