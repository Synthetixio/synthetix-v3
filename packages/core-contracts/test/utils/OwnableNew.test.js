const hre = require('hardhat');
const assert = require('assert');
const { ethers } = hre;
const { assertRevert } = require('@synthetixio/core-js/utils/assertions');
const { findEvent } = require('@synthetixio/core-js/utils/events');

describe('Ownable', () => {
  let Ownable;

  let owner, newOWner;

  before('identify signers', async () => {
    [owner, newOWner] = await ethers.getSigners();
  });

  before('deploy the contract', async () => {
    const factory = await ethers.getContractFactory('OwnableMock');
    Ownable = await factory.deploy(owner.address);
  });

  describe('before a new owner is nominated', () => {
    it('shows that the  owner is set correctly', async () => {
      assert.equal(await Ownable.owner(), owner.address);
    });

    it('shows that no new owner is nominated', async () => {
      assert.equal(await Ownable.nominatedOwner(), '0x0000000000000000000000000000000000000000');
    });
  });

  describe('when an non-owner tries to nominate a new owner', () => {
    it('reverts', async () => {
      await assertRevert(
        Ownable.connect(newOWner).nominateNewOwner(newOWner.address),
        'Only the owner can invoke'
      );
    });
  });

  describe('when an address is nominated', () => {
    before('nominate ownership', async () => {
      const tx = await Ownable.connect(owner).nominateNewOwner(newOWner.address);
      await tx.wait();
    });

    it('shows that the address is nominated', async () => {
      assert.equal(await Ownable.nominatedOwner(), newOWner.address);
    });

    describe('when the address accepts ownership', () => {
      let receipt;

      before('accept ownership', async () => {
        const tx = await Ownable.connect(newOWner).acceptOwnership();
        receipt = await tx.wait();
      });

      it('emitted an OwnerChanged event', async () => {
        const event = findEvent({ receipt, eventName: 'OwnerChanged' });

        assert.equal(event.args.newOwner, newOWner.address);
      });

      it('shows that the address is the new owner', async () => {
        assert.equal(await Ownable.owner(), newOWner.address);
      });

      it('shows that the address is no longer nominated', async () => {
        assert.equal(await Ownable.nominatedOwner(), '0x0000000000000000000000000000000000000000');
      });
    });
  });
});
