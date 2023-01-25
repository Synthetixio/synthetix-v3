import assert from 'node:assert/strict';
import { TransactionReceipt } from '@ethersproject/abstract-provider';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { findEvent } from '@synthetixio/core-utils/utils/ethers/events';
import { BigNumber, ethers } from 'ethers';
import hre from 'hardhat';
import {
  ERC721FailedReceiverMock,
  ERC721Mock,
  ERC721ReceiverMock,
  ERC721RevertingReceiverMock,
} from '../../../typechain-types';

describe('ERC721', function () {
  let ERC721: ERC721Mock;

  let user1: ethers.Signer;
  let user2: ethers.Signer;
  let user3: ethers.Signer;

  before('identify signers', async function () {
    [user1, user2, user3] = await hre.ethers.getSigners();
  });

  before('deploy the contract', async function () {
    const factory = await hre.ethers.getContractFactory('ERC721Mock');
    ERC721 = await factory.deploy();
    const tx = await ERC721.initialize('Synthetix NFT', 'snxNFT', '');
    await tx.wait();
  });

  describe('When attempting to initialize it again', function () {
    it('reverts', async function () {
      await assertRevert(
        ERC721.initialize('Synthetix NFT', 'snxNFT', 'http://synthetix.io'),
        'AlreadyInitialized()'
      );
    });
  });

  describe('When detecting the interfaces implemented', function () {
    const supportsInterface = (selector: number) => {
      return ERC721.supportsInterface(selector as unknown as string);
    };

    it('implements ERC165', async function () {
      assert.equal(await supportsInterface(0x01ffc9a7), true);
      assert.equal(await supportsInterface(0xffffffff), false);
    });
    it('implements ERC721', async function () {
      assert.equal(await supportsInterface(0x80ac58cd), true);
    });
    it('implements ERC721Metadata', async function () {
      assert.equal(await supportsInterface(0x5b5e139f), true);
    });
    it('does not implement a random interface', async function () {
      assert.equal(await supportsInterface(0x11223344), false);
    });
  });

  describe('Before minting any NFT', function () {
    it('the constructor arguments are set correctly', async function () {
      assert.equal(await ERC721.name(), 'Synthetix NFT');
      assert.equal(await ERC721.symbol(), 'snxNFT');
    });

    it('user does not have any NFT token minted', async function () {
      assertBn.equal(await ERC721.balanceOf(await user1.getAddress()), 0);
    });

    it('reverts if balanceOf called with an invalid owner', async () => {
      await assertRevert(ERC721.balanceOf(ethers.constants.AddressZero), 'InvalidOwner');
    });
  });

  describe('when NFTs are minted', function () {
    let receipt: TransactionReceipt;
    const token42 = 42;

    before('mint some NFTs', async function () {
      let tx = await ERC721.connect(user1).mint(1);
      await tx.wait();
      tx = await ERC721.connect(user1).mint(token42);
      receipt = await tx.wait();
    });

    it('emits a Transfer event', async function () {
      const evt = findEvent({ receipt, eventName: 'Transfer' });

      assert(!Array.isArray(evt) && evt?.args);
      assert.equal(evt.args.from, '0x0000000000000000000000000000000000000000');
      assert.equal(evt.args.to, await user1.getAddress());
      assertBn.equal(evt.args.tokenId, token42);
    });

    it('the user NFT accounts is increased', async function () {
      assertBn.equal(await ERC721.balanceOf(await user1.getAddress()), 2);
    });

    it('the minted NFT token belongs to the user', async function () {
      assert.equal(await ERC721.ownerOf(token42), await user1.getAddress());
    });

    it('reverts for owner of a non-existant NFT Id', async function () {
      await assertRevert(ERC721.ownerOf(24), 'TokenDoesNotExist(24)', ERC721);
    });

    describe('when attempting to mint again an existent Token', async function () {
      it('reverts', async function () {
        await assertRevert(ERC721.connect(user1).mint(token42), 'TokenAlreadyMinted("42")');
      });
    });

    describe('when attempting to mint to Zero Address', async function () {
      it('reverts', async function () {
        await assertRevert(
          ERC721.connect(user1).mintTo(ethers.constants.AddressZero, 1337),
          'ZeroAddress'
        );
      });
    });

    describe('when getting the token URI', async function () {
      it('gets the right token URI', async function () {
        assert.equal(await ERC721.tokenURI(token42), '');
      });

      it('reverts if tokenURI called with nonexistant NFT id', async () => {
        await assertRevert(ERC721.tokenURI(24), 'TokenDoesNotExist(24)', ERC721);
      });
    });

    describe('when tokens are burned', function () {
      before('burn', async function () {
        const tx = await ERC721.connect(user1).burn(1);
        receipt = await tx.wait();
      });

      it('reduces the user balance', async function () {
        assertBn.equal(await ERC721.balanceOf(await user1.getAddress()), 1);
      });

      it('emits a Transfer event', async function () {
        const evt = findEvent({ receipt, eventName: 'Transfer' });

        assert(!Array.isArray(evt) && evt?.args);
        assert.equal(evt.args.from, await user1.getAddress());
        assert.equal(evt.args.to, '0x0000000000000000000000000000000000000000');
        assertBn.equal(evt.args.tokenId, 1);
      });

      it('emits an Approval event', async function () {
        const evt = findEvent({ receipt, eventName: 'Approval' });

        assert(!Array.isArray(evt) && evt?.args);
        assert.equal(evt.args.owner, await user1.getAddress());
        assert.equal(evt.args.approved, '0x0000000000000000000000000000000000000000');
        assertBn.equal(evt.args.tokenId, 1);
      });

      after('mint again', async function () {
        const tx = await ERC721.connect(user1).mint(1);
        await tx.wait();
      });
    });

    describe('transferFrom()', function () {
      let user1Balance: BigNumber;
      let user2Balance: BigNumber;

      before('record balances and supply', async function () {
        user1Balance = await ERC721.balanceOf(await user1.getAddress());
        user2Balance = await ERC721.balanceOf(await user2.getAddress());
      });

      describe('when attempting to transfer a tokenId that does not exist', function () {
        it('reverts ', async function () {
          await assertRevert(
            ERC721.connect(user1).transferFrom(
              await user1.getAddress(),
              await user2.getAddress(),
              24
            ),
            'TokenDoesNotExist("24")'
          );
        });
      });

      describe('when transferring an existent tokenId', function () {
        before('transfer', async function () {
          const tx = await ERC721.connect(user1).transferFrom(
            await user1.getAddress(),
            await user2.getAddress(),
            token42
          );
          receipt = await tx.wait();
        });

        it('reduces the sender balance and increases the receiver balance', async function () {
          assertBn.equal(await ERC721.balanceOf(await user1.getAddress()), user1Balance.sub(1));
          assertBn.equal(await ERC721.balanceOf(await user2.getAddress()), user2Balance.add(1));
        });

        it('emits a Transfer event', async function () {
          const evt = findEvent({ receipt, eventName: 'Transfer' });

          assert(!Array.isArray(evt) && evt?.args);
          assert.equal(evt.args.from, await user1.getAddress());
          assert.equal(evt.args.to, await user2.getAddress());
          assertBn.equal(evt.args.tokenId, token42);
        });

        after('transfer it back', async function () {
          const tx = await ERC721.connect(user2).transferFrom(
            await user2.getAddress(),
            await user1.getAddress(),
            token42
          );
          await tx.wait();
        });
      });

      describe('when attempting to transfer a non owned tokenId', function () {
        it('reverts ', async function () {
          await assertRevert(
            ERC721.connect(user2).transferFrom(
              await user2.getAddress(),
              await user1.getAddress(),
              token42
            ),
            `Unauthorized("${await user2.getAddress()}")`
          );
        });
      });

      describe('when attempting to transfer a token from an invalid owner', function () {
        it('reverts ', async function () {
          await assertRevert(
            ERC721.connect(user1).transferFrom(
              await user2.getAddress(),
              await user1.getAddress(),
              42
            ),
            `Unauthorized("${await user2.getAddress()}")`
          );
        });
      });

      describe('when attempting to transfer a token to a Zero address', function () {
        it('reverts ', async function () {
          await assertRevert(
            ERC721.connect(user1).transferFrom(
              await user1.getAddress(),
              ethers.constants.AddressZero,
              42
            ),
            'ZeroAddress'
          );
        });
      });
    });

    describe('safeTransferFrom()', function () {
      describe('when transfering to a EOA', function () {
        before('transfer', async function () {
          const tx = await ERC721.connect(user1)['safeTransferFrom(address,address,uint256)'](
            await user1.getAddress(),
            await user2.getAddress(),
            token42
          );
          receipt = await tx.wait();
        });

        it('emits a Transfer event', async function () {
          const evt = findEvent({ receipt, eventName: 'Transfer' });

          assert(!Array.isArray(evt) && evt?.args);
          assert.equal(evt.args.from, await user1.getAddress());
          assert.equal(evt.args.to, await user2.getAddress());
          assertBn.equal(evt.args.tokenId, token42);
        });

        after('transfer it back', async function () {
          const tx = await ERC721.connect(user2).transferFrom(
            await user2.getAddress(),
            await user1.getAddress(),
            token42
          );
          await tx.wait();
        });
      });

      describe('when attempting to transfer to a contract not implementing the Receiver', function () {
        it('reverts ', async function () {
          await assertRevert(
            ERC721.connect(user1)['safeTransferFrom(address,address,uint256,bytes)'](
              await user1.getAddress(),
              ERC721.address,
              token42,
              '0x'
            ),
            `InvalidTransferRecipient("${ERC721.address}")`
          );
        });
      });

      describe('when attempting to transfer to a contract not accepting it', function () {
        let ERC721WrongReceiver: ERC721RevertingReceiverMock;

        before('deploy the contract', async function () {
          const factory = await hre.ethers.getContractFactory('ERC721RevertingReceiverMock');
          ERC721WrongReceiver = await factory.deploy();
        });

        it('reverts ', async function () {
          await assertRevert(
            ERC721.connect(user1)['safeTransferFrom(address,address,uint256)'](
              await user1.getAddress(),
              ERC721WrongReceiver.address,
              token42
            ),
            `InvalidTransferRecipient("${ERC721WrongReceiver.address}")`
          );
        });
      });

      describe('when attempting to transfer to a failed contract', function () {
        let ERC721WrongReceiver: ERC721FailedReceiverMock;

        before('deploy the contract', async function () {
          const factory = await hre.ethers.getContractFactory('ERC721FailedReceiverMock');
          ERC721WrongReceiver = await factory.deploy();
        });

        it('reverts ', async function () {
          await assertRevert(
            ERC721.connect(user1)['safeTransferFrom(address,address,uint256)'](
              await user1.getAddress(),
              ERC721WrongReceiver.address,
              token42
            ),
            `InvalidTransferRecipient("${ERC721WrongReceiver.address}")`
          );
        });
      });

      describe('when transfering to a valid contract', function () {
        let ERC721Receiver: ERC721ReceiverMock;

        before('deploy the contract', async function () {
          const factory = await hre.ethers.getContractFactory('ERC721ReceiverMock');
          ERC721Receiver = await factory.deploy();
        });

        before('transfer', async function () {
          const tx = await ERC721.connect(user1)['safeTransferFrom(address,address,uint256)'](
            await user1.getAddress(),
            ERC721Receiver.address,
            token42
          );
          receipt = await tx.wait();
        });

        it('emits a Transfer event', async function () {
          const evt = findEvent({ receipt, eventName: 'Transfer' });

          assert(!Array.isArray(evt) && evt?.args);
          assert.equal(evt.args.from, await user1.getAddress());
          assert.equal(evt.args.to, ERC721Receiver.address);
          assertBn.equal(evt.args.tokenId, token42);
        });

        after('transfer it back', async function () {
          const tx = await ERC721Receiver.transferToken(
            ERC721.address,
            await user1.getAddress(),
            token42
          );
          await tx.wait();
        });
      });

      describe('when attempting to transfer a non owned tokenId', function () {
        it('reverts ', async function () {
          await assertRevert(
            ERC721.connect(user2)['safeTransferFrom(address,address,uint256)'](
              await user2.getAddress(),
              await user1.getAddress(),
              token42
            ),
            `Unauthorized("${await user2.getAddress()}")`
          );
        });
      });

      describe('when attempting to transfer a token from an invalid owner', function () {
        it('reverts ', async function () {
          await assertRevert(
            ERC721.connect(user1)['safeTransferFrom(address,address,uint256)'](
              await user2.getAddress(),
              await user1.getAddress(),
              42
            ),
            `Unauthorized("${await user2.getAddress()}")`
          );
        });
      });

      describe('when attempting to transfer a token to a Zero address', function () {
        it('reverts ', async function () {
          await assertRevert(
            ERC721.connect(user1)['safeTransferFrom(address,address,uint256)'](
              await user1.getAddress(),
              ethers.constants.AddressZero,
              42
            ),
            'ZeroAddress'
          );
        });
      });
    });

    describe('Approve and TransferFrom', function () {
      let receipt: TransactionReceipt;

      before('approve', async function () {
        const tx = await ERC721.connect(user1).approve(await user3.getAddress(), token42);
        receipt = await tx.wait();
      });

      it('emits an Approval event', async function () {
        const evt = findEvent({ receipt, eventName: 'Approval' });

        assert(!Array.isArray(evt) && evt?.args);
        assert.equal(evt.args.owner, await user1.getAddress());
        assert.equal(evt.args.approved, await user3.getAddress());
        assertBn.equal(evt.args.tokenId, token42);
      });

      it('approves the user', async function () {
        assert.equal(await ERC721.getApproved(token42), await user3.getAddress());
      });

      describe('when attempting to transfer a non approved tokenId', function () {
        it('reverts ', async function () {
          await assertRevert(
            ERC721.connect(user3).transferFrom(
              await user1.getAddress(),
              await user2.getAddress(),
              1
            ),
            `Unauthorized("${await user3.getAddress()}")`
          );
        });
      });

      describe('when the approved account transfers the tokenId', function () {
        before('transfer', async function () {
          const tx = await ERC721.connect(user3).transferFrom(
            await user1.getAddress(),
            await user2.getAddress(),
            token42
          );
          await tx.wait();
        });

        it('is transferred', async function () {
          assert.equal(await ERC721.ownerOf(token42), await user2.getAddress());
        });

        it('the approval is cleared', async function () {
          assert.equal(await ERC721.getApproved(token42), ethers.constants.AddressZero);
        });

        after('transfer it back', async function () {
          const tx = await ERC721.connect(user2).transferFrom(
            await user2.getAddress(),
            await user1.getAddress(),
            token42
          );
          await tx.wait();
        });
      });

      describe('when attempting to check the aproval on a non existent tokenId', function () {
        it('reverts ', async function () {
          await assertRevert(ERC721.connect(user1).getApproved(1337), 'TokenDoesNotExist("1337")');
        });
      });

      describe('when attempting to approve the same owner', function () {
        it('reverts ', async function () {
          await assertRevert(
            ERC721.connect(user1).approve(await user1.getAddress(), token42),
            `CannotSelfApprove("${await user1.getAddress()}")`
          );
        });
      });

      describe('when not approved to approve', function () {
        it('reverts ', async function () {
          await assertRevert(
            ERC721.connect(user2).approve(await user3.getAddress(), token42),
            `Unauthorized("${await user2.getAddress()}")`
          );
        });
      });
    });

    describe('Approve Operator and TransferFrom', function () {
      let receipt: TransactionReceipt;

      before('setApprovalForAll', async function () {
        const tx = await ERC721.connect(user1).setApprovalForAll(await user3.getAddress(), true);
        receipt = await tx.wait();
      });

      it('emits an ApprovalForAll event', async function () {
        const evt = findEvent({ receipt, eventName: 'ApprovalForAll' });

        assert(!Array.isArray(evt) && evt?.args);
        assert.equal(evt.args.owner, await user1.getAddress());
        assert.equal(evt.args.operator, await user3.getAddress());
        assert.equal(evt.args.approved, true);
      });

      it('approves the operator', async function () {
        assert.equal(
          await ERC721.isApprovedForAll(await user1.getAddress(), await user3.getAddress()),
          true
        );
      });

      describe('when the approved account transfers the tokenId', function () {
        before('transfer', async function () {
          const tx = await ERC721.connect(user3).transferFrom(
            await user1.getAddress(),
            await user2.getAddress(),
            token42
          );
          await tx.wait();
        });

        it('is transfered', async function () {
          assert.equal(await ERC721.ownerOf(token42), await user2.getAddress());
        });

        it('any approval is cleared', async function () {
          assert.equal(await ERC721.getApproved(token42), ethers.constants.AddressZero);
        });

        after('transfer it back', async function () {
          const tx = await ERC721.connect(user2).transferFrom(
            await user2.getAddress(),
            await user1.getAddress(),
            token42
          );
          await tx.wait();
        });
      });

      describe('when attempting to approve the same owner', function () {
        it('reverts ', async function () {
          await assertRevert(
            ERC721.connect(user1).setApprovalForAll(await user1.getAddress(), true),
            `CannotSelfApprove("${await user1.getAddress()}")`
          );
        });
      });

      describe('clearing the approval', function () {
        before('clear ApprovalForAll', async function () {
          const tx = await ERC721.connect(user1).setApprovalForAll(await user3.getAddress(), false);
          receipt = await tx.wait();
        });

        it('emits an ApprovalForAll event', async function () {
          const evt = findEvent({ receipt, eventName: 'ApprovalForAll' });

          assert(!Array.isArray(evt) && evt?.args);
          assert.equal(evt.args.owner, await user1.getAddress());
          assert.equal(evt.args.operator, await user3.getAddress());
          assert.equal(evt.args.approved, false);
        });

        it('approves the operator', async function () {
          assert.equal(
            await ERC721.isApprovedForAll(await user1.getAddress(), await user3.getAddress()),
            false
          );
        });

        describe('when the previous approved operator attempts to transfers the tokenId', function () {
          it('reverts ', async function () {
            await assertRevert(
              ERC721.connect(user3).transferFrom(
                await user1.getAddress(),
                await user2.getAddress(),
                token42
              ),
              `Unauthorized("${await user3.getAddress()}")`
            );
          });
        });
      });
    });
  });

  describe('When attempting to initialize it with invalid values', function () {
    it('reverts', async function () {
      const factory = await hre.ethers.getContractFactory('ERC721Mock');
      const ERC721 = await factory.deploy();

      await assertRevert(
        ERC721.initialize('', '', ''),
        'InvalidParameter("name/symbol", "must not be empty")'
      );
    });
  });
});
