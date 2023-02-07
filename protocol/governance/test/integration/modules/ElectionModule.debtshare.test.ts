import hre from 'hardhat';
import { ethers } from 'ethers';
import assert from 'assert/strict';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import { bootstrap } from '../bootstrap';
import { DebtShareMock } from '../../../typechain-types';

describe('ElectionModule (debt shares)', () => {
  const { systems, signers } = bootstrap();

  let owner: ethers.Signer, user: ethers.Signer;

  before('identify signers', async () => {
    [owner, user] = signers();
  });

  describe('when attempting to reset the debt share contract', function () {
    describe('with a non owner account', function () {
      it('reverts', async function () {
        await assertRevert(
          systems()
            .Council.connect(user)
            .setDebtShareContract(await user.getAddress()),
          `Unauthorized("${await user.getAddress()}")`,
          systems().Council
        );
      });
    });

    describe('with the owner account', function () {
      describe('to the same address', function () {
        it('reverts', async function () {
          await assertRevert(
            systems().Council.setDebtShareContract(systems().DebtShare.address),
            'NoChange',
            systems().Council
          );
        });
      });

      describe('to an invalid address', function () {
        it('reverts', async function () {
          await assertRevert(
            systems().Council.setDebtShareContract('0x0000000000000000000000000000000000000000'),
            'ZeroAddress',
            systems().Council
          );
        });
      });

      describe('to an EOA', function () {
        it('reverts', async function () {
          await assertRevert(
            systems().Council.setDebtShareContract(await owner.getAddress()),
            'NotAContract',
            systems().Council
          );
        });
      });
    });

    describe('when resetting the debt share contract', function () {
      let txn: ethers.providers.TransactionReceipt;
      let newDebtShare: DebtShareMock;

      before('deploy a new debt shares mock', async function () {
        const factory = await hre.ethers.getContractFactory('DebtShareMock');
        newDebtShare = await factory.deploy();
      });

      before('set the new debt share contract', async function () {
        txn = await (await systems().Council.setDebtShareContract(newDebtShare.address)).wait();
      });

      it('set the new debt share contract', async function () {
        assert.equal(await systems().Council.getDebtShareContract(), newDebtShare.address);
      });

      it('emitted an event', async function () {
        await assertEvent(
          txn,
          `DebtShareContractSet("${newDebtShare.address}")`,
          systems().Council
        );
      });
    });
  });
});
