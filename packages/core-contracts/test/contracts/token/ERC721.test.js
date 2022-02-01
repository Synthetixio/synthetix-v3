const { ethers } = hre;
const assert = require('assert/strict');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');

describe('ERC721', () => {
  let ERC721;

  let user1, user2, user3;

  before('identify signers', async () => {
    [user1, user2, user3] = await ethers.getSigners();
  });

  before('deploy the contract', async () => {
    const factory = await ethers.getContractFactory('ERC721Mock');
    ERC721 = await factory.deploy();
    const tx = await ERC721.initialize('Synthetix NFT', 'snxNFT', '');
    await tx.wait();
  });

  describe('When attempting to initialize it again', () => {
    it('reverts', async () => {
      await assertRevert(
        ERC721.initialize('Synthetix NFT', 'snxNFT', 'http://synthetix.io'),
        'AlreadyInitialized()'
      );
    });
  });

  describe('When detecting the interfaces implemented', () => {
    it('implements ERC165', async () => {
      assert.equal(await ERC721.supportsInterface(0x01ffc9a7), true);
      assert.equal(await ERC721.supportsInterface(0xffffffff), false);
    });
    it('implements ERC721', async () => {
      assert.equal(await ERC721.supportsInterface(0x80ac58cd), true);
    });
    it('implements ERC721Metadata', async () => {
      assert.equal(await ERC721.supportsInterface(0x5b5e139f), true);
    });
    it('does not implement a random interface', async () => {
      assert.equal(await ERC721.supportsInterface(0x11223344), false);
    });
  });

  describe('Before minting any NFT', () => {
    it('the constructor arguments are set correctly', async () => {
      assert.equal(await ERC721.name(), 'Synthetix NFT');
      assert.equal(await ERC721.symbol(), 'snxNFT');
    });

    it('user does not have any NFT token minted', async () => {
      assertBn.equal(await ERC721.balanceOf(user1.address), 0);
    });

    it('reverts checking the balance of 0x0 address', async () => {
      await assertRevert(ERC721.balanceOf(ethers.constants.AddressZero), 'ZeroAddress');
    });
  });

  describe('when NFTs are minted', () => {
    let receipt;
    const token42 = 42;

    before('mint some NFTs', async () => {
      let tx = await ERC721.connect(user1).mint(1);
      await tx.wait();
      tx = await ERC721.connect(user1).mint(token42);
      receipt = await tx.wait();
    });

    it('emits a Transfer event', async () => {
      const event = findEvent({ receipt, eventName: 'Transfer' });

      assert.equal(event.args.from, '0x0000000000000000000000000000000000000000');
      assert.equal(event.args.to, user1.address);
      assertBn.equal(event.args.tokenId, token42);
    });

    it('the user NFT accounts is increased', async () => {
      assertBn.equal(await ERC721.balanceOf(user1.address), 2);
    });

    it('the minted NFT token belongs to the user', async () => {
      assert.equal(await ERC721.ownerOf(token42), user1.address);
    });

    it('reverts checking the owner for a wrong NFT Id', async () => {
      await assertRevert(ERC721.ownerOf(24), 'TokenDoesNotExist(24)');
    });

    describe('when attempting to mint again an existent Token', async () => {
      it('reverts', async () => {
        await assertRevert(ERC721.connect(user1).mint(token42), 'TokenAlreadyMinted(42)');
      });
    });

    describe('when attempting to mint to Zero Address', async () => {
      it('reverts', async () => {
        await assertRevert(
          ERC721.connect(user1).mintTo(ethers.constants.AddressZero, 1337),
          'ZeroAddress'
        );
      });
    });

    describe('when getting the token URI', async () => {
      it('gets the right token URI', async () => {
        assert.equal(await ERC721.tokenURI(token42), '');
      });

      it('reverts for an invalid tokenID', async () => {
        await assertRevert(ERC721.tokenURI(24), 'TokenDoesNotExist(24)');
      });
    });

    describe('when tokens are burned', () => {
      before('burn', async () => {
        const tx = await ERC721.connect(user1).burn(1);
        receipt = await tx.wait();
      });

      it('reduces the user balance', async () => {
        assertBn.equal(await ERC721.balanceOf(user1.address), 1);
      });

      it('emits a Transfer event', async () => {
        const event = findEvent({ receipt, eventName: 'Transfer' });

        assert.equal(event.args.from, user1.address);
        assert.equal(event.args.to, '0x0000000000000000000000000000000000000000');
        assertBn.equal(event.args.tokenId, 1);
      });

      it('emits an Approval event', async () => {
        const event = findEvent({ receipt, eventName: 'Approval' });

        assert.equal(event.args.owner, user1.address);
        assert.equal(event.args.approved, '0x0000000000000000000000000000000000000000');
        assertBn.equal(event.args.tokenId, 1);
      });

      after('mint again', async () => {
        const tx = await ERC721.connect(user1).mint(1);
        await tx.wait();
      });
    });

    describe('transferFrom()', () => {
      let user1Balance, user2Balance;

      before('record balances and supply', async () => {
        user1Balance = await ERC721.balanceOf(user1.address);
        user2Balance = await ERC721.balanceOf(user2.address);
      });

      describe('when attempting to transfer an unexistent tokenId', () => {
        it('reverts ', async () => {
          await assertRevert(
            ERC721.connect(user1).transferFrom(user1.address, user2.address, 24),
            'TokenDoesNotExist(24)'
          );
        });
      });

      describe('when transfering an existent tokenId', () => {
        before('transfer', async () => {
          const tx = await ERC721.connect(user1).transferFrom(
            user1.address,
            user2.address,
            token42
          );
          receipt = await tx.wait();
        });

        it('reduces the sender balance and increases the receiver balance', async () => {
          assertBn.equal(await ERC721.balanceOf(user1.address), user1Balance.sub(1));
          assertBn.equal(await ERC721.balanceOf(user2.address), user2Balance.add(1));
        });

        it('emits a Transfer event', async () => {
          const event = findEvent({ receipt, eventName: 'Transfer' });

          assert.equal(event.args.from, user1.address);
          assert.equal(event.args.to, user2.address);
          assertBn.equal(event.args.tokenId, token42);
        });

        after('transfer it back', async () => {
          const tx = await ERC721.connect(user2).transferFrom(
            user2.address,
            user1.address,
            token42
          );
          await tx.wait();
        });
      });

      describe('when attempting to transfer a non owned tokenId', () => {
        it('reverts ', async () => {
          await assertRevert(
            ERC721.connect(user2).transferFrom(user2.address, user1.address, token42),
            `Unauthorized("${user2.address}")`
          );
        });
      });

      describe('when attempting to transfer a token from an invalid owner', () => {
        it('reverts ', async () => {
          await assertRevert(
            ERC721.connect(user1).transferFrom(user2.address, user1.address, 42),
            `Unauthorized("${user2.address}")`
          );
        });
      });

      describe('when attempting to transfer a token to a Zero address', () => {
        it('reverts ', async () => {
          await assertRevert(
            ERC721.connect(user1).transferFrom(user1.address, ethers.constants.AddressZero, 42),
            'ZeroAddress'
          );
        });
      });
    });

    describe('safeTransferFrom()', () => {
      describe('when transfering to a EOA', () => {
        before('transfer', async () => {
          const tx = await ERC721.connect(user1)['safeTransferFrom(address,address,uint256)'](
            user1.address,
            user2.address,
            token42
          );
          receipt = await tx.wait();
        });

        it('emits a Transfer event', async () => {
          const event = findEvent({ receipt, eventName: 'Transfer' });

          assert.equal(event.args.from, user1.address);
          assert.equal(event.args.to, user2.address);
          assertBn.equal(event.args.tokenId, token42);
        });

        after('transfer it back', async () => {
          const tx = await ERC721.connect(user2).transferFrom(
            user2.address,
            user1.address,
            token42
          );
          await tx.wait();
        });
      });

      describe('when attempting to transfer to a contract not implementing the Receiver', () => {
        it('reverts ', async () => {
          await assertRevert(
            ERC721.connect(user1)['safeTransferFrom(address,address,uint256,bytes)'](
              user1.address,
              ERC721.address,
              token42,
              '0x'
            ),
            `InvalidTransferRecipient("${ERC721.address}")`
          );
        });
      });

      describe('when attempting to transfer to a contract not accepting it', () => {
        let ERC721WrongReceiver;

        before('deploy the contract', async () => {
          const factory = await ethers.getContractFactory('ERC721RevertingReceiverMock');
          ERC721WrongReceiver = await factory.deploy();
        });

        it('reverts ', async () => {
          await assertRevert(
            ERC721.connect(user1)['safeTransferFrom(address,address,uint256)'](
              user1.address,
              ERC721WrongReceiver.address,
              token42
            ),
            `InvalidTransferRecipient("${ERC721WrongReceiver.address}")`
          );
        });
      });

      describe('when attempting to transfer to a failed contract', () => {
        let ERC721WrongReceiver;

        before('deploy the contract', async () => {
          const factory = await ethers.getContractFactory('ERC721FailedReceiverMock');
          ERC721WrongReceiver = await factory.deploy();
        });

        it('reverts ', async () => {
          await assertRevert(
            ERC721.connect(user1)['safeTransferFrom(address,address,uint256)'](
              user1.address,
              ERC721WrongReceiver.address,
              token42
            ),
            `InvalidTransferRecipient("${ERC721WrongReceiver.address}")`
          );
        });
      });

      describe('when transfering to a valid contract', () => {
        let ERC721Receiver;

        before('deploy the contract', async () => {
          const factory = await ethers.getContractFactory('ERC721ReceiverMock');
          ERC721Receiver = await factory.deploy();
        });

        before('transfer', async () => {
          const tx = await ERC721.connect(user1)['safeTransferFrom(address,address,uint256)'](
            user1.address,
            ERC721Receiver.address,
            token42
          );
          receipt = await tx.wait();
        });

        it('emits a Transfer event', async () => {
          const event = findEvent({ receipt, eventName: 'Transfer' });

          assert.equal(event.args.from, user1.address);
          assert.equal(event.args.to, ERC721Receiver.address);
          assertBn.equal(event.args.tokenId, token42);
        });

        after('transfer it back', async () => {
          const tx = await ERC721Receiver.transferToken(ERC721.address, user1.address, token42);
          await tx.wait();
        });
      });

      describe('when attempting to transfer a non owned tokenId', () => {
        it('reverts ', async () => {
          await assertRevert(
            ERC721.connect(user2)['safeTransferFrom(address,address,uint256)'](
              user2.address,
              user1.address,
              token42
            ),
            `Unauthorized("${user2.address}")`
          );
        });
      });

      describe('when attempting to transfer a token from an invalid owner', () => {
        it('reverts ', async () => {
          await assertRevert(
            ERC721.connect(user1)['safeTransferFrom(address,address,uint256)'](
              user2.address,
              user1.address,
              42
            ),
            `Unauthorized("${user2.address}")`
          );
        });
      });

      describe('when attempting to transfer a token to a Zero address', () => {
        it('reverts ', async () => {
          await assertRevert(
            ERC721.connect(user1)['safeTransferFrom(address,address,uint256)'](
              user1.address,
              ethers.constants.AddressZero,
              42
            ),
            'ZeroAddress'
          );
        });
      });
    });

    describe('Approve and TransferFrom', () => {
      let receipt;
      before('approve', async () => {
        const tx = await ERC721.connect(user1).approve(user3.address, token42);
        receipt = await tx.wait();
      });

      it('emits an Approval event', async () => {
        const event = findEvent({ receipt, eventName: 'Approval' });

        assert.equal(event.args.owner, user1.address);
        assert.equal(event.args.approved, user3.address);
        assertBn.equal(event.args.tokenId, token42);
      });

      it('approves the user', async () => {
        assert.equal(await ERC721.getApproved(token42), user3.address);
      });

      describe('when attempting to transfer a non approved tokenId', () => {
        it('reverts ', async () => {
          await assertRevert(
            ERC721.connect(user3).transferFrom(user1.address, user2.address, 1),
            `Unauthorized("${user3.address}")`
          );
        });
      });

      describe('when the approved account transfers the tokenId', () => {
        before('transfer', async () => {
          const tx = await ERC721.connect(user3).transferFrom(
            user1.address,
            user2.address,
            token42
          );
          await tx.wait();
        });

        it('is transfered', async () => {
          assert.equal(await ERC721.ownerOf(token42), user2.address);
        });

        it('the approval is cleared', async () => {
          assert.equal(await ERC721.getApproved(token42), ethers.constants.AddressZero);
        });

        after('transfer it back', async () => {
          const tx = await ERC721.connect(user2).transferFrom(
            user2.address,
            user1.address,
            token42
          );
          await tx.wait();
        });
      });

      describe('when attempting to check the aproval on a non existent tokenId', () => {
        it('reverts ', async () => {
          await assertRevert(ERC721.connect(user1).getApproved(1337), 'TokenDoesNotExist(1337)');
        });
      });

      describe('when attempting to approve the same owner', () => {
        it('reverts ', async () => {
          await assertRevert(
            ERC721.connect(user1).approve(user1.address, token42),
            `CannotSelfApprove("${user1.address}")`
          );
        });
      });

      describe('when not approved to approve', () => {
        it('reverts ', async () => {
          await assertRevert(
            ERC721.connect(user2).approve(user3.address, token42),
            `Unauthorized("${user2.address}")`
          );
        });
      });
    });

    describe('Approve Operator and TransferFrom', () => {
      let receipt;
      before('setApprovalForAll', async () => {
        const tx = await ERC721.connect(user1).setApprovalForAll(user3.address, true);
        receipt = await tx.wait();
      });

      it('emits an ApprovalForAll event', async () => {
        const event = findEvent({ receipt, eventName: 'ApprovalForAll' });

        assert.equal(event.args.owner, user1.address);
        assert.equal(event.args.operator, user3.address);
        assert.equal(event.args.approved, true);
      });

      it('approves the operator', async () => {
        assert.equal(await ERC721.isApprovedForAll(user1.address, user3.address), true);
      });

      describe('when the approved account transfers the tokenId', () => {
        before('transfer', async () => {
          const tx = await ERC721.connect(user3).transferFrom(
            user1.address,
            user2.address,
            token42
          );
          await tx.wait();
        });

        it('is transfered', async () => {
          assert.equal(await ERC721.ownerOf(token42), user2.address);
        });

        it('any approval is cleared', async () => {
          assert.equal(await ERC721.getApproved(token42), ethers.constants.AddressZero);
        });

        after('transfer it back', async () => {
          const tx = await ERC721.connect(user2).transferFrom(
            user2.address,
            user1.address,
            token42
          );
          await tx.wait();
        });
      });

      describe('when attempting to approve the same owner', () => {
        it('reverts ', async () => {
          await assertRevert(
            ERC721.connect(user1).setApprovalForAll(user1.address, true),
            `CannotSelfApprove("${user1.address}")`
          );
        });
      });

      describe('clearing the approval', () => {
        before('clear ApprovalForAll', async () => {
          const tx = await ERC721.connect(user1).setApprovalForAll(user3.address, false);
          receipt = await tx.wait();
        });

        it('emits an ApprovalForAll event', async () => {
          const event = findEvent({ receipt, eventName: 'ApprovalForAll' });

          assert.equal(event.args.owner, user1.address);
          assert.equal(event.args.operator, user3.address);
          assert.equal(event.args.approved, false);
        });

        it('approves the operator', async () => {
          assert.equal(await ERC721.isApprovedForAll(user1.address, user3.address), false);
        });

        describe('when the previous approved operator attempts to transfers the tokenId', () => {
          it('reverts ', async () => {
            await assertRevert(
              ERC721.connect(user3).transferFrom(user1.address, user2.address, token42),
              `Unauthorized("${user3.address}")`
            );
          });
        });
      });
    });
  });
});
