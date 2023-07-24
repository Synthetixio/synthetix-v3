import assert from 'node:assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';
import hre from 'hardhat';
import { bootstrap } from '../../bootstrap';

import type { CoreProxy, DebtShareMock } from '../../generated/typechain';

describe('SynthetixElectionModule - DebtShare', function () {
  const { c, getSigners, deployNewProxy } = bootstrap();

  let owner: ethers.Signer;

  before('identify signers', async function () {
    [owner] = getSigners();
  });

  describe('before initializing the election module', function () {
    let CoreProxy: CoreProxy;

    before('create a new uninitialized CoreProxy', async () => {
      CoreProxy = await deployNewProxy();
    });

    describe('when trying to retrieve the current debt share of a user', function () {
      it('returns zero', async function () {
        assertBn.equal(await CoreProxy.getDebtShare(await owner.getAddress()), 0);
      });
    });
  });

  describe('when the election module is initialized', function () {
    it('shows that the DebtShare contract is connected', async function () {
      assert.equal(await c.CoreProxy.getDebtShareContract(), c.DebtShareMock.address);
    });

    describe('when trying to retrieve the current debt share snapshot id', function () {
      it('reverts', async function () {
        await assertRevert(c.CoreProxy.getDebtShareSnapshotId(), 'DebtShareSnapshotIdNotSet');
      });
    });

    describe('when trying to retrieve the current debt share of a user', function () {
      it('returns zero', async function () {
        assertBn.equal(await c.CoreProxy.getDebtShare(await owner.getAddress()), 0);
      });
    });

    describe('when re setting the debt share contract', function () {
      describe('with the same address', function () {
        it('reverts', async function () {
          await assertRevert(c.CoreProxy.setDebtShareContract(c.DebtShareMock.address), 'NoChange');
        });
      });

      describe('with an invalid address', function () {
        it('reverts', async function () {
          await assertRevert(
            c.CoreProxy.setDebtShareContract(ethers.constants.AddressZero),
            'ZeroAddress'
          );
        });
      });

      describe('with an EOA', function () {
        it('reverts', async function () {
          await assertRevert(
            c.CoreProxy.setDebtShareContract(await owner.getAddress()),
            'NotAContract'
          );
        });
      });

      describe('with a different address', function () {
        let DebtShare: DebtShareMock;
        let rx: ethers.ContractReceipt;

        before('deploy debt shares mock', async function () {
          const factory = await hre.ethers.getContractFactory('DebtShareMock');
          DebtShare = await factory.deploy();
        });

        before('set the new debt share contract', async function () {
          const tx = await c.CoreProxy.setDebtShareContract(DebtShare.address);
          rx = await tx.wait();
        });

        it('emitted a DebtShareContractSet event', async function () {
          await assertEvent(rx, `DebtShareContractSet("${DebtShare.address}")`, c.CoreProxy);
        });

        it('shows that the DebtShare contract is connected', async function () {
          assert.equal(await c.CoreProxy.getDebtShareContract(), DebtShare.address);
        });
      });
    });
  });
});
