const { ethers } = hre;
const assert = require('assert/strict');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');

describe('ERC721Owned', () => {
  let ERC721;

  let owner, user1, user2;

  before('identify signers', async () => {
    [owner, user1, user2] = await ethers.getSigners();
  });

  before('deploy the contract', async () => {
    const factory = await ethers.getContractFactory('ERC721OwnedMock');
    ERC721 = await factory.deploy();
    const tx = await ERC721.initialize('Synthetix NFT', 'snxNFT', '');
    await tx.wait();
  });

  before('set owner', async () => {
    let tx = await ERC721.connect(owner).nominateNewOwner(owner.address);
    await tx.wait();
    tx = await ERC721.connect(owner).acceptOwnership();
    await tx.wait();
  });

  describe('when NFTs are minted', () => {
    const token42 = 42;
    const token2 = 2;

    before('mint some NFTs', async () => {
      let tx = await ERC721.connect(owner).mint(token42);
      await tx.wait();
      tx = await ERC721.connect(owner).mintTo(user1.address, token2);
      await tx.wait();
    });

    it('the users NFT accounts is increased', async () => {
      assertBn.equal(await ERC721.balanceOf(owner.address), 1);
      assertBn.equal(await ERC721.balanceOf(user1.address), 1);
    });

    it('the minted NFT token belongs to the user', async () => {
      assert.equal(await ERC721.ownerOf(token42), owner.address);
      assert.equal(await ERC721.ownerOf(token2), user1.address);
    });

    describe('transferFrom()', () => {
      let ownerBalance, user1Balance, user2Balance;

      before('record balances and supply', async () => {
        ownerBalance = await ERC721.balanceOf(owner.address);
        user1Balance = await ERC721.balanceOf(user1.address);
        user2Balance = await ERC721.balanceOf(user2.address);
      });

      describe('when transfering tokens as contract owner', () => {
        describe('when transfering holded token', () => {
          before('transfer', async () => {
            const tx = await ERC721.connect(owner).transferFrom(
              owner.address,
              user2.address,
              token42
            );
            await tx.wait();
          });

          it('reduces the sender balance and increases the receiver balance', async () => {
            assertBn.equal(await ERC721.balanceOf(owner.address), ownerBalance.sub(1));
            assertBn.equal(await ERC721.balanceOf(user2.address), user2Balance.add(1));
          });

          after('transfer it back', async () => {
            const tx = await ERC721.connect(owner).transferFrom(
              user2.address,
              owner.address,
              token42
            );
            await tx.wait();
          });
        });

        describe('when transfering a token holded by an user', () => {
          before('transfer', async () => {
            const tx = await ERC721.connect(owner).transferFrom(
              user1.address,
              user2.address,
              token2
            );
            await tx.wait();
          });

          it('reduces the sender balance and increases the receiver balance', async () => {
            assertBn.equal(await ERC721.balanceOf(user1.address), user1Balance.sub(1));
            assertBn.equal(await ERC721.balanceOf(user2.address), user2Balance.add(1));
          });

          after('transfer it back', async () => {
            const tx = await ERC721.connect(owner).transferFrom(
              user2.address,
              user1.address,
              token2
            );
            await tx.wait();
          });
        });
      });

      describe('when attempting to transfer a holded tokenId (not owner)', () => {
        it('reverts ', async () => {
          await assertRevert(
            ERC721.connect(user1).transferFrom(user1.address, user2.address, token2),
            'Unauthorized'
          );
        });
      });
    });

    describe('safeTransferFrom(address,address,uint256,bytes)', () => {
      let ownerBalance, user1Balance, user2Balance;

      before('record balances and supply', async () => {
        ownerBalance = await ERC721.balanceOf(owner.address);
        user1Balance = await ERC721.balanceOf(user1.address);
        user2Balance = await ERC721.balanceOf(user2.address);
      });

      describe('when transfering tokens as contract owner', () => {
        describe('when transfering holded token', () => {
          before('transfer', async () => {
            const tx = await ERC721.connect(owner)[
              'safeTransferFrom(address,address,uint256,bytes)'
            ](owner.address, user2.address, token42, '0x');
            await tx.wait();
          });

          it('reduces the sender balance and increases the receiver balance', async () => {
            assertBn.equal(await ERC721.balanceOf(owner.address), ownerBalance.sub(1));
            assertBn.equal(await ERC721.balanceOf(user2.address), user2Balance.add(1));
          });

          after('transfer it back', async () => {
            const tx = await ERC721.connect(owner)[
              'safeTransferFrom(address,address,uint256,bytes)'
            ](user2.address, owner.address, token42, '0x');
            await tx.wait();
          });
        });

        describe('when transfering a token holded by an user', () => {
          before('transfer', async () => {
            const tx = await ERC721.connect(owner)[
              'safeTransferFrom(address,address,uint256,bytes)'
            ](user1.address, user2.address, token2, '0x');
            await tx.wait();
          });

          it('reduces the sender balance and increases the receiver balance', async () => {
            assertBn.equal(await ERC721.balanceOf(user1.address), user1Balance.sub(1));
            assertBn.equal(await ERC721.balanceOf(user2.address), user2Balance.add(1));
          });

          after('transfer it back', async () => {
            const tx = await ERC721.connect(owner)[
              'safeTransferFrom(address,address,uint256,bytes)'
            ](user2.address, user1.address, token2, '0x');
            await tx.wait();
          });
        });
      });

      describe('when attempting to transfer a holded tokenId (not owner)', () => {
        it('reverts ', async () => {
          await assertRevert(
            ERC721.connect(user1)['safeTransferFrom(address,address,uint256,bytes)'](
              user1.address,
              user2.address,
              token2,
              '0x'
            ),
            'Unauthorized'
          );
        });
      });
    });

    describe('safeTransferFrom(address,address,uint256)', () => {
      let ownerBalance, user1Balance, user2Balance;

      before('record balances and supply', async () => {
        ownerBalance = await ERC721.balanceOf(owner.address);
        user1Balance = await ERC721.balanceOf(user1.address);
        user2Balance = await ERC721.balanceOf(user2.address);
      });

      describe('when transfering tokens as contract owner', () => {
        describe('when transfering holded token', () => {
          before('transfer', async () => {
            const tx = await ERC721.connect(owner)['safeTransferFrom(address,address,uint256)'](
              owner.address,
              user2.address,
              token42
            );
            await tx.wait();
          });

          it('reduces the sender balance and increases the receiver balance', async () => {
            assertBn.equal(await ERC721.balanceOf(owner.address), ownerBalance.sub(1));
            assertBn.equal(await ERC721.balanceOf(user2.address), user2Balance.add(1));
          });

          after('transfer it back', async () => {
            const tx = await ERC721.connect(owner)['safeTransferFrom(address,address,uint256)'](
              user2.address,
              owner.address,
              token42
            );
            await tx.wait();
          });
        });

        describe('when transfering a token holded by an user', () => {
          before('transfer', async () => {
            const tx = await ERC721.connect(owner)['safeTransferFrom(address,address,uint256)'](
              user1.address,
              user2.address,
              token2
            );
            await tx.wait();
          });

          it('reduces the sender balance and increases the receiver balance', async () => {
            assertBn.equal(await ERC721.balanceOf(user1.address), user1Balance.sub(1));
            assertBn.equal(await ERC721.balanceOf(user2.address), user2Balance.add(1));
          });

          after('transfer it back', async () => {
            const tx = await ERC721.connect(owner)['safeTransferFrom(address,address,uint256)'](
              user2.address,
              user1.address,
              token2
            );
            await tx.wait();
          });
        });
      });

      describe('when attempting to transfer a holded tokenId (not owner)', () => {
        it('reverts ', async () => {
          await assertRevert(
            ERC721.connect(user1)['safeTransferFrom(address,address,uint256)'](
              user1.address,
              user2.address,
              token2
            ),
            'Unauthorized'
          );
        });
      });
    });
  });
});
