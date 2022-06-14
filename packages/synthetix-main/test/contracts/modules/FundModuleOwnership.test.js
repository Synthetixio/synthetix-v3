const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');

describe('FundModule - Create / Ownership', function () {
  const { proxyAddress } = bootstrap(initializer);

  let user1, user2;

  let FundModule;

  before('identify signers', async () => {
    [, user1, user2] = await ethers.getSigners();
  });

  before('identify modules', async () => {
    FundModule = await ethers.getContractAt('FundModule', proxyAddress());
  });

  describe('When creating a Fund', async () => {
    let receipt;

    before('create a fund', async () => {
      const tx = await FundModule.connect(user1).createFund(1, user1.address);
      receipt = await tx.wait();
    });

    it('emmited an event', async () => {
      const event = findEvent({ receipt, eventName: 'FundCreated' });

      assert.equal(event.args.owner, user1.address);
      assertBn.equal(event.args.fundId, 1);
    });

    it('is created', async () => {
      assert.equal(await FundModule.ownerOf(1), user1.address);
    });

    describe('when trying to create the same FundModuleId', () => {
      it('reverts', async () => {
        await assertRevert(
          FundModule.connect(user2).createFund(1, user1.address),
          'FundAlreadyExists(1)'
        );
      });
    });

    describe('when transfering to a new owner', async () => {
      describe('when attempting to accept before nominating', async () => {
        it('reverts', async () => {
          await assertRevert(
            FundModule.connect(user2).acceptFundOwnership(1),
            `Unauthorized("${user2.address}")`
          );
        });
      });

      describe('when nominating a new owner', async () => {
        let receipt;
        before('', async () => {
          const tx = await FundModule.connect(user1).nominateNewFundOwner(user2.address, 1);
          receipt = await tx.wait();
        });

        it('emits an event', async () => {
          const event = findEvent({ receipt, eventName: 'NominatedNewOwner' });

          assertBn.equal(event.args.fundId, 1);
          assert.equal(event.args.nominatedOwner, user2.address);
        });

        describe('when accepting the ownership', async () => {
          before('accept ownership', async () => {
            const tx = await FundModule.connect(user2).acceptFundOwnership(1);
            receipt = await tx.wait();
          });

          after('return ownership to user1', async () => {
            await (await FundModule.connect(user2).nominateNewFundOwner(user1.address, 1)).wait();
            await (await FundModule.connect(user1).acceptFundOwnership(1)).wait();
          });

          it('emits an event', async () => {
            const event = findEvent({ receipt, eventName: 'OwnershipAccepted' });

            assertBn.equal(event.args.fundId, 1);
            assert.equal(event.args.newOwner, user2.address);
          });

          it('is the new owner', async () => {
            assert.equal(await FundModule.ownerOf(1), user2.address);
          });
        });
      });

      describe('when renouncint the ownership', async () => {
        let receipt;
        before('nominate the new owner', async () => {
          const tx = await FundModule.connect(user1).nominateNewFundOwner(user2.address, 1);
          receipt = await tx.wait();
        });

        before('renounce nomination', async () => {
          const tx = await FundModule.connect(user2).renounceFundNomination(1);
          receipt = await tx.wait();
        });

        it('emits an event', async () => {
          const event = findEvent({ receipt, eventName: 'OwnershipRenounced' });

          assertBn.equal(event.args.fundId, 1);
          assert.equal(event.args.target, user2.address);
        });

        it('ownership did not change', async () => {
          assert.equal(await FundModule.ownerOf(1), user1.address);
        });

        describe('when attempting to accept the nomination after renouncing to it', async () => {
          it('reverts', async () => {
            await assertRevert(
              FundModule.connect(user2).acceptFundOwnership(1),
              `Unauthorized("${user2.address}")`
            );
          });
        });
      });
    });
  });
});
