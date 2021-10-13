const hre = require('hardhat');
const assert = require('assert');
const { ethers } = hre;
const { getProxyAddress } = require('@synthetixio/deployer/utils/deployments');
const assertRevert = require('@synthetixio/core-js/utils/assert-revert');
const { findEvent } = require('@synthetixio/core-js/utils/events');
const bootstrap = require('./helpers/bootstrap');

describe('OwnerModule', () => {
  const { deploymentInfo } = bootstrap();

  let OwnerModule;

  let owner, user;

  before('identify signers', async () => {
    [owner, user] = await ethers.getSigners();
  });

  before('identify modules', async () => {
    const proxyAddress = getProxyAddress(deploymentInfo);

    OwnerModule = await ethers.getContractAt('OwnerModule', proxyAddress);
  });

  describe('before an owner is set or nominated', () => {
    it('shows that no owner is set', async () => {
      assert.equal(await OwnerModule.owner(), '0x0000000000000000000000000000000000000000');
    });

    it('shows that no owner is nominated', async () => {
      assert.equal(
        await OwnerModule.nominatedOwner(),
        '0x0000000000000000000000000000000000000000'
      );
    });
  });

  describe('when an address is nominated', () => {
    before('nominate ownership', async () => {
      const tx = await OwnerModule.connect(owner).nominateNewOwner(owner.address);
      await tx.wait();
    });

    it('shows that the address is nominated', async () => {
      assert.equal(await OwnerModule.nominatedOwner(), owner.address);
    });

    describe('when the address accepts ownership', () => {
      let receipt;

      before('accept ownership', async () => {
        const tx = await OwnerModule.connect(owner).acceptOwnership();
        receipt = await tx.wait();
      });

      it('emitted an OwnerChanged event', async () => {
        const event = findEvent({ receipt, eventName: 'OwnerChanged' });

        assert.equal(event.args.newOwner, owner.address);
      });

      it('shows that the address is the new owner', async () => {
        assert.equal(await OwnerModule.owner(), owner.address);
      });

      it('shows that the address is no longer nominated', async () => {
        assert.equal(
          await OwnerModule.nominatedOwner(),
          '0x0000000000000000000000000000000000000000'
        );
      });

      describe('when a regular user tries to nominate a new owner', () => {
        it('reverts', async () => {
          await assertRevert(
            OwnerModule.connect(user).nominateNewOwner(user.address),
            'Only owner can invoke'
          );
        });
      });

      describe('when the owner nominates a new owner', () => {
        before('nominate new owner', async () => {
          const tx = await OwnerModule.connect(owner).nominateNewOwner(user.address);
          await tx.wait();
        });

        it('shows that the user is nominated', async () => {
          assert.equal(await OwnerModule.nominatedOwner(), user.address);
        });

        describe('when the owner rejects the nomination', () => {
          before('reject the nomination', async () => {
            const tx = await OwnerModule.connect(owner).renounceNomination();
            await tx.wait();
          });

          it('shows that the address is no longer nominated', async () => {
            assert.equal(
              await OwnerModule.nominatedOwner(),
              '0x0000000000000000000000000000000000000000'
            );
          });
        });
      });
    });
  });
});
