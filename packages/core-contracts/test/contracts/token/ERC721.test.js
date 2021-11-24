const { ethers } = hre;
const assert = require('assert/strict');
const assertRevert = require('@synthetixio/core-js/utils/assert-revert');
const assertBn = require('@synthetixio/core-js/utils/assert-bignumber');
const { findEvent } = require('@synthetixio/core-js/utils/events');

describe('ERC721', () => {
  let ERC721;

  let user1, user2;

  before('identify signers', async () => {
    [user1, user2] = await ethers.getSigners();
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
      assertBn.eq(await ERC721.balanceOf(user1.address), 0);
    });

    it('reverts checking the balance of 0x0 address', async () => {
      await assertRevert(
        ERC721.balanceOf(ethers.constants.AddressZero),
        'InvalidOwner("0x0000000000000000000000000000000000000000")'
      );
    });
  });

  describe('when NFTs are minted', () => {
    let receipt;
    const token42 = 42;

    before('mint some NFTs', async () => {
      let tx = await ERC721.connect(user1).mint(1);
      await tx.wait();
      tx = await ERC721.connect(user1).mint(2);
      await tx.wait();
      tx = await ERC721.connect(user1).mint(token42);
      receipt = await tx.wait();
    });

    it('emits a Transfer event', async () => {
      const event = findEvent({ receipt, eventName: 'Transfer' });

      assert.equal(event.args.from, '0x0000000000000000000000000000000000000000');
      assert.equal(event.args.to, user1.address);
      assertBn.eq(event.args.tokenId, token42);
    });

    it('mints a couple of NFTs to the user', async () => {
      assertBn.eq(await ERC721.balanceOf(user1.address), 3);
    });

    it('the minted NFT token belongs to the user', async () => {
      assert.equal(await ERC721.ownerOf(token42), user1.address);
    });

    it('reverts checking the owner for a wrong NFT Id', async () => {
      await assertRevert(ERC721.ownerOf(24), 'InvalidTokenId(24)');
    });

    describe('when getting the token URI', async () => {
      it('gets the right token URI', async () => {
        assert.equal(await ERC721.tokenURI(token42), '');
      });

      it('reverts for an invalid tokenID', async () => {
        await assertRevert(ERC721.tokenURI(24), 'InvalidTokenId(24)');
      });
    });

    describe('when tokens are burned', () => {
      before('burn', async () => {
        const tx = await ERC721.connect(user1).burn(1);
        receipt = await tx.wait();
      });

      it('reduces the user balance', async () => {
        assertBn.eq(await ERC721.balanceOf(user1.address), 2);
      });

      it('emits a Transfer event', async () => {
        const event = findEvent({ receipt, eventName: 'Transfer' });

        assert.equal(event.args.from, user1.address);
        assert.equal(event.args.to, '0x0000000000000000000000000000000000000000');
        assertBn.eq(event.args.tokenId, 1);
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
            'InvalidTokenId(24)'
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
          assertBn.eq(await ERC721.balanceOf(user1.address), user1Balance.sub(1));
          assertBn.eq(await ERC721.balanceOf(user2.address), user2Balance.add(1));
        });

        it('emits a Transfer event', async () => {
          const event = findEvent({ receipt, eventName: 'Transfer' });

          assert.equal(event.args.from, user1.address);
          assert.equal(event.args.to, user2.address);
          assertBn.eq(event.args.tokenId, token42);
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
            ERC721.connect(user2).transferFrom(user2.address, user1.address, 42),
            `Unauthorized("${user2.address}")`
          );
        });
      });

      describe('when attempting to transfer a token from an invalid owner', () => {
        it('reverts ', async () => {
          await assertRevert(
            ERC721.connect(user1).transferFrom(user2.address, user1.address, 42),
            `InvalidFrom("${user2.address}")`
          );
        });
      });

      describe('when attempting to transfer a token to a Zero address', () => {
        it('reverts ', async () => {
          await assertRevert(
            ERC721.connect(user1).transferFrom(user1.address, ethers.constants.AddressZero, 42),
            `InvalidTo("${ethers.constants.AddressZero}")`
          );
        });
      });
    });

    describe('safeTransferFrom()', () => {});

    describe('Approve and TransferFrom', () => {});

    describe('Approve Operator and TransferFrom', () => {
      // const approvalAmount = ethers.BigNumber.from('10');
      // let user1Balance, user2Balance;
      // before('record balances', async () => {
      //   user1Balance = await ERC721.balanceOf(user1.address);
      //   user2Balance = await ERC721.balanceOf(user2.address);
      // });
      // before('approve', async () => {
      //   const tx = await ERC721.connect(user1).approve(user2.address, approvalAmount);
      //   receipt = await tx.wait();
      // });
      // it('sets the right allowance', async () => {
      //   assertBn.eq(await ERC721.allowance(user1.address, user2.address), approvalAmount);
      // });
      // it('emits an Approval event', async () => {
      //   const event = findEvent({ receipt, eventName: 'Approval' });
      //   assert.equal(event.args.owner, user1.address);
      //   assert.equal(event.args.spender, user2.address);
      //   assertBn.eq(event.args.amount, approvalAmount);
      // });
      // describe('when trying to transfer more than the amount approved', () => {
      //   it('reverts ', async () => {
      //     const amount = approvalAmount.add(1);
      //     await assertRevert(
      //       ERC721.connect(user2).transferFrom(user1.address, user2.address, amount),
      //       `InsufficientAllowance(${amount.toString()}, ${approvalAmount.toString()})`
      //     );
      //   });
      // });
      // describe('when transfering less or equal than the approval amount', () => {
      //   const transferFromAmount = approvalAmount.sub(1);
      //   before('transferFrom to itself', async () => {
      //     let tx = await ERC721.connect(user2).transferFrom(
      //       user1.address,
      //       user2.address,
      //       transferFromAmount
      //     );
      //     receipt = await tx.wait();
      //     // get the new, reduced allowance
      //     const newAllowance = await ERC721.allowance(user1.address, user2.address);
      //     // transferFrom the remaining allowance
      //     tx = await ERC721.connect(user2).transferFrom(user1.address,
      // user2.address, newAllowance);
      //     await tx.wait();
      //   });
      //   it('the allowance should be 0', async () => {
      //     assertBn.eq(await ERC721.allowance(user1.address, user2.address), '0');
      //   });
      //   it('updates the user balances accordingly', async () => {
      //     assertBn.eq(await ERC721.balanceOf(user1.address),
      // user1Balance.sub(approvalAmount));
      //     assertBn.eq(await ERC721.balanceOf(user2.address),
      // user2Balance.add(approvalAmount));
      //   });
      //   it('emits a Transfer event', async () => {
      //     const event = findEvent({ receipt, eventName: 'Transfer' });
      //     assert.equal(event.args.from, user1.address);
      //     assert.equal(event.args.to, user2.address);
      //     assertBn.eq(event.args.amount, transferFromAmount);
      //   });
      // });
    });
  });
});
