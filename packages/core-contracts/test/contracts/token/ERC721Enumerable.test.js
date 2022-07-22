const { ethers } = hre;
const assert = require('assert/strict');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');

describe.only('ERC721Enumerable', () => {
  let ERC721Enumerable;

  let user1, user2, user3;

  before('identify signers', async () => {
    [user1, user2, user3] = await ethers.getSigners();
  });

  beforeEach('deploy the contract', async () => {
    const factory = await ethers.getContractFactory('ERC721EnumerableMock');
    ERC721Enumerable = await factory.deploy();
    const tx = await ERC721Enumerable.initialize('Synthetix NFT', 'snxNFT', '');
    await tx.wait();
  });

  describe('interfaces', () => {
    it('implements ERC721', async () => {
      assert.equal(await ERC721Enumerable.supportsInterface(0x80ac58cd), true);
    });
    it('does not implement a random interface', async () => {
      assert.equal(await ERC721Enumerable.supportsInterface(0x11223344), false);
    });
  });

  describe('mint', () => {
    it('properly attribute to user', async () => {
      ERC721Enumerable.mintTo(user1.address, 100);
      ERC721Enumerable.mintTo(user1.address, 101);
      ERC721Enumerable.mintTo(user2.address, 200);
      ERC721Enumerable.mintTo(user2.address, 201);
      assertBn.equal(await ERC721Enumerable.tokenOfOwnerByIndex(user1.address, 0), 100);
      assertBn.equal(await ERC721Enumerable.tokenOfOwnerByIndex(user1.address, 1), 101);
      assertBn.equal(await ERC721Enumerable.tokenOfOwnerByIndex(user2.address, 0), 200);

      await assertRevert(
        ERC721Enumerable.tokenOfOwnerByIndex(user1.address, 2),
        'IndexOutOfBounds()'
      );
    });
  });

  describe('burn', () => {
    it('properly removes token from user mapping', async () => {
      await ERC721Enumerable.mintTo(user1.address, 300);
      await ERC721Enumerable.mintTo(user1.address, 301);
      await ERC721Enumerable.burn(301);

      assertBn.equal(await ERC721Enumerable.tokenOfOwnerByIndex(user1.address, 0), 300);
      await assertRevert(
        ERC721Enumerable.tokenOfOwnerByIndex(user1.address, 1),
        'IndexOutOfBounds()'
      );
    });
  });

  describe('transfer', () => {
    it('properly removes token from user mapping', async () => {
      await ERC721Enumerable.mintTo(user1.address, 400);
      await ERC721Enumerable.mintTo(user1.address, 401);
      await ERC721Enumerable.transfer(user1.address, user2.address, 401);

      assertBn.equal(await ERC721Enumerable.tokenOfOwnerByIndex(user1.address, 0), 400);
      assertBn.equal(await ERC721Enumerable.tokenOfOwnerByIndex(user2.address, 0), 401);
      await assertRevert(
        ERC721Enumerable.tokenOfOwnerByIndex(user1.address, 1),
        'IndexOutOfBounds()'
      );
    });
  });

  describe('totalSupply', () => {
    it('shows correct nft count', async () => {
      await ERC721Enumerable.mintTo(user1.address, 400);
      await ERC721Enumerable.mintTo(user1.address, 401);
      await ERC721Enumerable.mintTo(user2.address, 402);
      await ERC721Enumerable.mintTo(user2.address, 403);
      await ERC721Enumerable.mintTo(user3.address, 404);
      await ERC721Enumerable.mintTo(user3.address, 405);

      assertBn.equal(await ERC721Enumerable.totalSupply(), 6);
      assertBn.equal(await ERC721Enumerable.tokenByIndex(0), 400);
      assertBn.equal(await ERC721Enumerable.tokenByIndex(5), 405);
      await assertRevert(ERC721Enumerable.tokenByIndex(6), 'IndexOutOfBounds()');
    });
  });
});
