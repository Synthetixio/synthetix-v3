import assert from 'node:assert/strict';
import { TransactionReceipt } from '@ethersproject/abstract-provider';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { findEvent } from '@synthetixio/core-utils/utils/ethers/events';
import { ethers } from 'ethers';
import hre from 'hardhat';
import { Ownable } from '../../../typechain-types';

describe('Ownable', function () {
  let Ownable: Ownable;

  let owner: ethers.Signer;
  let newOwner: ethers.Signer;
  let user: ethers.Signer;

  before('identify signers', async function () {
    [owner, newOwner, user] = await hre.ethers.getSigners();
  });

  before('deploy the contract', async function () {
    const factory = await hre.ethers.getContractFactory('Ownable');
    Ownable = await factory.deploy(await owner.getAddress());
  });

  describe('before an owner is set', function () {
    it('shows that the  owner is 0x0', async function () {
      assert.equal(await Ownable.owner(), await owner.getAddress());
    });

    it('shows that no new owner is nominated', async function () {
      assert.equal(await Ownable.nominatedOwner(), '0x0000000000000000000000000000000000000000');
    });
  });

  describe('after an owner is set', function () {
    describe('Nominating a new owner', function () {
      let receipt: TransactionReceipt;

      describe('when an non-owner tries to nominate a new owner', function () {
        it('reverts', async function () {
          await assertRevert(
            Ownable.connect(newOwner).nominateNewOwner(await newOwner.getAddress()),
            `Unauthorized("${await newOwner.getAddress()}")`
          );
        });
      });

      describe('when an owner tries to nominate address 0x0 as the new owner', function () {
        it('reverts', async function () {
          const addressZero = '0x0000000000000000000000000000000000000000';
          await assertRevert(Ownable.connect(owner).nominateNewOwner(addressZero), 'ZeroAddress');
        });
      });

      before('nominateNewOwner', async function () {
        const tx = await Ownable.connect(owner).nominateNewOwner(await newOwner.getAddress());
        receipt = await tx.wait();
      });

      it('shows that the address is nominated', async function () {
        assert.equal(await Ownable.nominatedOwner(), await newOwner.getAddress());
      });

      it('emitted an OwnerNominated event', async function () {
        const evt = findEvent({ receipt, eventName: 'OwnerNominated' });

        assert(!Array.isArray(evt) && evt?.args);
        assert.equal(evt.args.newOwner, await newOwner.getAddress());
      });

      describe('when attempting to re-nominate the same owner', function () {
        it('reverts', async function () {
          await assertRevert(
            Ownable.connect(owner).nominateNewOwner(await newOwner.getAddress()),
            'NoChange'
          );
        });
      });

      describe('Accepting ownership', function () {
        describe('when an non nominated address tries to accepts ownership', function () {
          it('reverts', async function () {
            await assertRevert(
              Ownable.connect(owner).acceptOwnership(),
              `NotNominated("${await owner.getAddress()}")`
            );
          });
        });

        describe('when the nominated address accepts ownership', function () {
          before('accept ownership', async function () {
            const tx = await Ownable.connect(newOwner).acceptOwnership();
            receipt = await tx.wait();
          });

          after('return ownership', async function () {
            let tx;

            tx = await Ownable.connect(newOwner).nominateNewOwner(await owner.getAddress());
            await tx.wait();

            tx = await Ownable.connect(owner).acceptOwnership();
            await tx.wait();
          });

          it('emits an OwnerChanged event', async function () {
            const evt = findEvent({ receipt, eventName: 'OwnerChanged' });

            assert(!Array.isArray(evt) && evt?.args);
            assert.equal(evt.args.newOwner, await newOwner.getAddress());
          });

          it('shows that the address is the new owner', async function () {
            assert.equal(await Ownable.owner(), await newOwner.getAddress());
          });

          it('shows that the address is no longer nominated', async function () {
            assert.equal(
              await Ownable.nominatedOwner(),
              '0x0000000000000000000000000000000000000000'
            );
          });
        });
      });

      describe('Renouncing nomination', function () {
        describe('when there is no nomination', function () {
          it('reverts', async function () {
            await assertRevert(
              Ownable.connect(newOwner).renounceNomination(),
              `NotNominated("${await newOwner.getAddress()}")`
            );
          });
        });

        describe('when there is a nomination', function () {
          before('nominateNewOwner', async function () {
            const tx = await Ownable.connect(owner).nominateNewOwner(await newOwner.getAddress());
            await tx.wait();
          });

          it('shows that the right address is nominated', async function () {
            assert.equal(await Ownable.nominatedOwner(), await newOwner.getAddress());
          });

          describe('when a non nominated user tries to renounce', function () {
            it('reverts', async function () {
              await assertRevert(
                Ownable.connect(user).renounceNomination(),
                `NotNominated("${await user.getAddress()}")`
              );
            });
          });

          describe('when the nominated owner renounces', function () {
            before('renounce nomination', async function () {
              const tx = await Ownable.connect(newOwner).renounceNomination();
              await tx.wait();
            });

            it('shows that there is no address nominated', async function () {
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
