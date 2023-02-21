import assert from 'node:assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { BigNumber, ethers } from 'ethers';
import hre from 'hardhat';
import { ERC721OwnedMock } from '../../../typechain-types';

describe('ERC721Owned', function () {
  let ERC721: ERC721OwnedMock;

  let owner: ethers.Signer;
  let user1: ethers.Signer;
  let user2: ethers.Signer;

  before('identify signers', async function () {
    [owner, user1, user2] = await hre.ethers.getSigners();
  });

  before('deploy the contract', async function () {
    const factory = await hre.ethers.getContractFactory('ERC721OwnedMock');
    ERC721 = await factory.deploy(await owner.getAddress());
    const tx = await ERC721.initialize('Synthetix NFT', 'snxNFT', '');
    await tx.wait();
  });

  describe('when NFTs are minted', function () {
    const token42 = 42;
    const token2 = 2;

    before('mint some NFTs', async function () {
      let tx = await ERC721.connect(owner).mint(token42);
      await tx.wait();
      tx = await ERC721.connect(owner).mintTo(await user1.getAddress(), token2);
      await tx.wait();
    });

    it('the users NFT accounts is increased', async function () {
      assertBn.equal(await ERC721.balanceOf(await owner.getAddress()), 1);
      assertBn.equal(await ERC721.balanceOf(await user1.getAddress()), 1);
    });

    it('the minted NFT token belongs to the user', async function () {
      assert.equal(await ERC721.ownerOf(token42), await owner.getAddress());
      assert.equal(await ERC721.ownerOf(token2), await user1.getAddress());
    });

    describe('transferFrom()', function () {
      let ownerBalance: BigNumber;
      let user1Balance: BigNumber;
      let user2Balance: BigNumber;

      before('record balances and supply', async function () {
        ownerBalance = await ERC721.balanceOf(await owner.getAddress());
        user1Balance = await ERC721.balanceOf(await user1.getAddress());
        user2Balance = await ERC721.balanceOf(await user2.getAddress());
      });

      describe('when transfering tokens as contract owner', function () {
        describe('when transfering holded token', function () {
          before('transfer', async function () {
            const tx = await ERC721.connect(owner).transferFrom(
              await owner.getAddress(),
              await user2.getAddress(),
              token42
            );
            await tx.wait();
          });

          it('reduces the sender balance and increases the receiver balance', async function () {
            assertBn.equal(await ERC721.balanceOf(await owner.getAddress()), ownerBalance.sub(1));
            assertBn.equal(await ERC721.balanceOf(await user2.getAddress()), user2Balance.add(1));
          });

          after('transfer it back', async function () {
            const tx = await ERC721.connect(owner).transferFrom(
              await user2.getAddress(),
              await owner.getAddress(),
              token42
            );
            await tx.wait();
          });
        });

        describe('when transfering a token holded by an user', function () {
          before('transfer', async function () {
            const tx = await ERC721.connect(owner).transferFrom(
              await user1.getAddress(),
              await user2.getAddress(),
              token2
            );
            await tx.wait();
          });

          it('reduces the sender balance and increases the receiver balance', async function () {
            assertBn.equal(await ERC721.balanceOf(await user1.getAddress()), user1Balance.sub(1));
            assertBn.equal(await ERC721.balanceOf(await user2.getAddress()), user2Balance.add(1));
          });

          after('transfer it back', async function () {
            const tx = await ERC721.connect(owner).transferFrom(
              await user2.getAddress(),
              await user1.getAddress(),
              token2
            );
            await tx.wait();
          });
        });
      });

      describe('when attempting to transfer a holded tokenId (not owner)', function () {
        it('reverts ', async function () {
          await assertRevert(
            ERC721.connect(user1).transferFrom(
              await user1.getAddress(),
              await user2.getAddress(),
              token2
            ),
            `Unauthorized("${await user1.getAddress()}")`
          );
        });
      });
    });

    describe('safeTransferFrom(address,address,uint256,bytes)', function () {
      let ownerBalance: BigNumber;
      let user1Balance: BigNumber;
      let user2Balance: BigNumber;

      before('record balances and supply', async function () {
        ownerBalance = await ERC721.balanceOf(await owner.getAddress());
        user1Balance = await ERC721.balanceOf(await user1.getAddress());
        user2Balance = await ERC721.balanceOf(await user2.getAddress());
      });

      describe('when transfering tokens as contract owner', function () {
        describe('when transfering holded token', function () {
          before('transfer', async function () {
            const tx = await ERC721.connect(owner)[
              'safeTransferFrom(address,address,uint256,bytes)'
            ](await owner.getAddress(), await user2.getAddress(), token42, '0x');
            await tx.wait();
          });

          it('reduces the sender balance and increases the receiver balance', async function () {
            assertBn.equal(await ERC721.balanceOf(await owner.getAddress()), ownerBalance.sub(1));
            assertBn.equal(await ERC721.balanceOf(await user2.getAddress()), user2Balance.add(1));
          });

          after('transfer it back', async function () {
            const tx = await ERC721.connect(owner)[
              'safeTransferFrom(address,address,uint256,bytes)'
            ](await user2.getAddress(), await owner.getAddress(), token42, '0x');
            await tx.wait();
          });
        });

        describe('when transfering a token holded by an user', function () {
          before('transfer', async function () {
            const tx = await ERC721.connect(owner)[
              'safeTransferFrom(address,address,uint256,bytes)'
            ](await user1.getAddress(), await user2.getAddress(), token2, '0x');
            await tx.wait();
          });

          it('reduces the sender balance and increases the receiver balance', async function () {
            assertBn.equal(await ERC721.balanceOf(await user1.getAddress()), user1Balance.sub(1));
            assertBn.equal(await ERC721.balanceOf(await user2.getAddress()), user2Balance.add(1));
          });

          after('transfer it back', async function () {
            const tx = await ERC721.connect(owner)[
              'safeTransferFrom(address,address,uint256,bytes)'
            ](await user2.getAddress(), await user1.getAddress(), token2, '0x');
            await tx.wait();
          });
        });
      });

      describe('when attempting to transfer a holded tokenId (not owner)', function () {
        it('reverts ', async function () {
          await assertRevert(
            ERC721.connect(user1)['safeTransferFrom(address,address,uint256,bytes)'](
              await user1.getAddress(),
              await user2.getAddress(),
              token2,
              '0x'
            ),
            `Unauthorized("${await user1.getAddress()}")`
          );
        });
      });
    });

    describe('safeTransferFrom(address,address,uint256)', function () {
      let ownerBalance: BigNumber;
      let user1Balance: BigNumber;
      let user2Balance: BigNumber;

      before('record balances and supply', async function () {
        ownerBalance = await ERC721.balanceOf(await owner.getAddress());
        user1Balance = await ERC721.balanceOf(await user1.getAddress());
        user2Balance = await ERC721.balanceOf(await user2.getAddress());
      });

      describe('when transfering tokens as contract owner', function () {
        describe('when transfering holded token', function () {
          before('transfer', async function () {
            const tx = await ERC721.connect(owner)['safeTransferFrom(address,address,uint256)'](
              await owner.getAddress(),
              await user2.getAddress(),
              token42
            );
            await tx.wait();
          });

          it('reduces the sender balance and increases the receiver balance', async function () {
            assertBn.equal(await ERC721.balanceOf(await owner.getAddress()), ownerBalance.sub(1));
            assertBn.equal(await ERC721.balanceOf(await user2.getAddress()), user2Balance.add(1));
          });

          after('transfer it back', async function () {
            const tx = await ERC721.connect(owner)['safeTransferFrom(address,address,uint256)'](
              await user2.getAddress(),
              await owner.getAddress(),
              token42
            );
            await tx.wait();
          });
        });

        describe('when transfering a token holded by an user', function () {
          before('transfer', async function () {
            const tx = await ERC721.connect(owner)['safeTransferFrom(address,address,uint256)'](
              await user1.getAddress(),
              await user2.getAddress(),
              token2
            );
            await tx.wait();
          });

          it('reduces the sender balance and increases the receiver balance', async function () {
            assertBn.equal(await ERC721.balanceOf(await user1.getAddress()), user1Balance.sub(1));
            assertBn.equal(await ERC721.balanceOf(await user2.getAddress()), user2Balance.add(1));
          });

          after('transfer it back', async function () {
            const tx = await ERC721.connect(owner)['safeTransferFrom(address,address,uint256)'](
              await user2.getAddress(),
              await user1.getAddress(),
              token2
            );
            await tx.wait();
          });
        });
      });

      describe('when attempting to transfer a holded tokenId (not owner)', function () {
        it('reverts ', async function () {
          await assertRevert(
            ERC721.connect(user1)['safeTransferFrom(address,address,uint256)'](
              await user1.getAddress(),
              await user2.getAddress(),
              token2
            ),
            `Unauthorized("${await user1.getAddress()}")`
          );
        });
      });
    });
  });
});
