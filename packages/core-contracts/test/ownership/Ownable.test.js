const hre = require('hardhat');
const assert = require('assert');
const { ethers } = hre;
const assertRevert = require('@synthetixio/core-js/utils/assert-revert');
const { findEvent } = require('@synthetixio/core-js/utils/events');

describe('Ownable', () => {
  let Ownable;

  let owner, newOwner;

  before('identify signers', async () => {
    [owner, newOwner] = await ethers.getSigners();
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

  describe('Nominating a new owner', () => {
    let receipt;

    describe('when an non-owner tries to nominate a new owner', () => {
      it('reverts', async () => {
        await assertRevert(
          Ownable.connect(newOwner).nominateNewOwner(newOwner.address),
          'OnlyOwnerAllowed()'
        );
      });
    });

    describe('when an owner tries to nominate address 0x0 as the new owner', () => {
      it('reverts', async () => {
        const addressZero = '0x0000000000000000000000000000000000000000';
        await assertRevert(
          Ownable.connect(owner).nominateNewOwner(addressZero),
          `InvalidAddress("${addressZero}")`
        );
      });
    });

    before('nominateNewOwner', async () => {
      const tx = await Ownable.connect(owner).nominateNewOwner(newOwner.address);
      receipt = await tx.wait();
    });

    it('shows that the address is nominated', async () => {
      assert.equal(await Ownable.nominatedOwner(), newOwner.address);
    });

    it('emitted an OwnerNominated event', async () => {
      const event = findEvent({ receipt, eventName: 'OwnerNominated' });

      assert.equal(event.args.newOwner, newOwner.address);
    });

    describe('when attempting to re-nominate the same owner', () => {
      it('reverts', async () => {
        await assertRevert(
          Ownable.connect(owner).nominateNewOwner(newOwner.address),
          `InvalidNomination("${newOwner.address}")`
        );
      });
    });

    describe('Accepting ownership', () => {
      describe('when an non nominated address tries to accepts ownership', () => {
        it('reverts', async () => {
          await assertRevert(
            Ownable.connect(owner).acceptOwnership(),
            `NotNominated("${owner.address}")`
          );
        });
      });

      describe('when the nominated address accepts ownership', () => {
        before('acceptOwnership', async () => {
          const tx = await Ownable.connect(newOwner).acceptOwnership();
          receipt = await tx.wait();
        });

        it('emits an OwnerChanged event', async () => {
          const event = findEvent({ receipt, eventName: 'OwnerChanged' });

          assert.equal(event.args.newOwner, newOwner.address);
        });

        it('shows that the address is the new owner', async () => {
          assert.equal(await Ownable.owner(), newOwner.address);
        });

        it('shows that the address is no longer nominated', async () => {
          assert.equal(
            await Ownable.nominatedOwner(),
            '0x0000000000000000000000000000000000000000'
          );
        });
      });
    });

    describe('Renouncing nomination', () => {
      describe('when there is no nomination', () => {
        it('reverts', async () => {
          await assertRevert(Ownable.connect(newOwner).renounceNomination(), 'NoNomination()');

          describe('when there is a nomination', () => {
            before('nominateNewOwner', async () => {
              const tx = await Ownable.connect(newOwner).nominateNewOwner(owner.address);
              await tx.wait();
            });

            it('shows that the right address is nominated', async () => {
              assert.equal(await Ownable.nominatedOwner(), owner.address);
            });

            describe('when a non owner renounces', () => {
              it('reverts', async () => {
                await assertRevert(
                  Ownable.connect(owner).renounceNomination(),
                  'OnlyOwnerAllowed()'
                );
              });

              describe('when the current owner renounces', () => {
                before('nominateNewOwner', async () => {
                  const tx = await Ownable.connect(newOwner).renounceNomination();
                  await tx.wait();
                });

                it('shows that there is no address nominated', async () => {
                  assert.equal(
                    await Ownable.nominatedOwner(),
                    '0x0000000000000000000000000000000000000000'
                  );
                });
              });
            });
          });
        });
      });
    });
  });
});
