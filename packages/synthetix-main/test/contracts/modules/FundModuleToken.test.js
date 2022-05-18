const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');

describe('FundModule - FundToken - Ownership', function () {
  const { proxyAddress } = bootstrap(initializer);

  let owner, user1, user2, userAdmin, user4;

  let FundModule, fundTokenAddress, FundToken;

  before('identify signers', async () => {
    [owner, user1, user2, userAdmin, user4] = await ethers.getSigners();
  });

  before('identify modules', async () => {
    FundModule = await ethers.getContractAt('FundModule', proxyAddress());
  });

  before('Initialize (Create a FundToken token)', async () => {
    await (await FundModule.connect(owner).initializeFundModule()).wait();
    fundTokenAddress = await FundModule.getFundTokenAddress();

    FundToken = await ethers.getContractAt('FundToken', fundTokenAddress);
  });

  describe('when attempting to mint an account token from the satellite', async () => {
    it('reverts', async () => {
      await assertRevert(
        FundToken.connect(user1).mint(user1.address, 1),
        `Unauthorized("${user1.address}")`
      );
    });
  });

  describe('When minting an FundToken', async () => {
    let receipt;

    before('mint an accoun token', async () => {
      const tx = await FundModule.connect(user1).mintFund(1, user1.address);
      receipt = await tx.wait();
    });

    it('emmited an event', async () => {
      const event = findEvent({ receipt, eventName: 'FundMinted', contract: FundToken });

      assert.equal(event.args.owner, user1.address);
      assertBn.equal(event.args.fundId, 1);
    });

    it('is created', async () => {
      assert.equal(await FundToken.ownerOf(1), user1.address);
      assertBn.equal(await FundToken.balanceOf(user1.address), 1);
    });

    describe('when trying to mint the same FundTokenId', () => {
      it('reverts', async () => {
        await assertRevert(
          FundModule.connect(user2).mintFund(1, user1.address),
          'TokenAlreadyMinted(1)'
        );
      });
    });

    describe('when attempting to call transferFund directly', async () => {
      it('reverts', async () => {
        await assertRevert(
          FundModule.connect(user1).transferFund(user2.address, 1),
          `OnlyTokenProxyAllowed("${user1.address}")`
        );
      });
    });

    describe('when attempting to use the NFT transfer functions', async () => {
      it('reverts when calling transferFrom', async () => {
        await assertRevert(
          FundToken.connect(user1).transferFrom(user1.address, user2.address, 1),
          `NotAllowed()`
        );
      });

      it('reverts when calling safeTransferFrom', async () => {
        await assertRevert(
          FundToken.connect(user1)['safeTransferFrom(address,address,uint256)'](
            user1.address,
            user2.address,
            1
          ),
          `NotAllowed()`
        );
      });

      it('reverts when calling safeTransferFrom with data', async () => {
        await assertRevert(
          FundToken.connect(user1)['safeTransferFrom(address,address,uint256,bytes)'](
            user1.address,
            user2.address,
            1,
            '0x'
          ),
          `NotAllowed()`
        );
      });
    });

    describe('when transfering to a new owner', async () => {
      describe('when attempting to accept before nominating', async () => {
        it('reverts', async () => {
          await assertRevert(
            FundToken.connect(user2).acceptFundOwnership(1),
            `Unauthorized("${user2.address}")`
          );
        });
      });

      describe('when nominating a new owner', async () => {
        let receipt;
        before('', async () => {
          const tx = await FundToken.connect(user1).nominateNewFundOwner(user2.address, 1);
          receipt = await tx.wait();
        });

        it('emits an event', async () => {
          const event = findEvent({ receipt, eventName: 'NominatedNewOwner' });

          assertBn.equal(event.args.fundId, 1);
          assert.equal(event.args.nominatedOwner, user2.address);
        });

        describe('when accepting the ownership', async () => {
          before('accept ownership', async () => {
            const tx = await FundToken.connect(user2).acceptFundOwnership(1);
            receipt = await tx.wait();
          });

          after('return ownership to user1', async () => {
            await (await FundToken.connect(user2).nominateNewFundOwner(user1.address, 1)).wait();
            await (await FundToken.connect(user1).acceptFundOwnership(1)).wait();
          });

          it('emits an event', async () => {
            const event = findEvent({ receipt, eventName: 'OwnershipAccepted' });

            assertBn.equal(event.args.fundId, 1);
            assert.equal(event.args.newOwner, user2.address);
          });

          it('is the new owner', async () => {
            assert.equal(await FundToken.ownerOf(1), user2.address);
            assertBn.equal(await FundToken.balanceOf(user2.address), 1);
            assertBn.equal(await FundToken.balanceOf(user1.address), 0);
          });
        });
      });

      describe('when renouncint the ownership', async () => {
        let receipt;
        before('nominate the new owner', async () => {
          const tx = await FundToken.connect(user1).nominateNewFundOwner(user2.address, 1);
          receipt = await tx.wait();
        });

        before('renounce nomination', async () => {
          const tx = await FundToken.connect(user2).renounceFundNomination(1);
          receipt = await tx.wait();
        });

        it('emits an event', async () => {
          const event = findEvent({ receipt, eventName: 'OwnershipRenounced' });

          assertBn.equal(event.args.fundId, 1);
          assert.equal(event.args.target, user2.address);
        });

        it('ownership did not change', async () => {
          assert.equal(await FundToken.ownerOf(1), user1.address);
          assertBn.equal(await FundToken.balanceOf(user1.address), 1);
          assertBn.equal(await FundToken.balanceOf(user2.address), 0);
        });

        describe('when attempting to accept the nomination after renouncing to it', async () => {
          it('reverts', async () => {
            await assertRevert(
              FundToken.connect(user2).acceptFundOwnership(1),
              `Unauthorized("${user2.address}")`
            );
          });
        });
      });
    });
  });
});
