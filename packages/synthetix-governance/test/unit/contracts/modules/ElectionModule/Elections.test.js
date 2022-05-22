const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../../../helpers/initializer');
const { getTime, fastForwardTo } = require('@synthetixio/core-js/utils/hardhat/rpc');
const { daysToSeconds } = require('@synthetixio/core-js/utils/misc/dates');
const { ElectionPeriod } = require('@synthetixio/core-modules/test/contracts/modules/ElectionModule/helpers/election-helper');
const {
  simulateDebtShareData,
  expectedDebtShare,
  expectedVotePower,
} = require('./helpers/debt-share-helper');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');

describe.only('SynthetixElectionModule - general elections', function () {
  const { proxyAddress } = bootstrap(initializer);

  let ElectionModule, DebtShare;

  let owner;
  let user1, user2, user3;

  let receipt;

  let debtShareSnapshotId;

  before('identify signers', async () => {
    const users = await ethers.getSigners();

    [owner, user1, user2, user3] = users;
  });

  before('identify modules', async () => {
    ElectionModule = await ethers.getContractAt(
      'contracts/modules/ElectionModule.sol:ElectionModule',
      proxyAddress()
    );
  });

  before('deploy debt shares mock', async function () {
    const factory = await ethers.getContractFactory('DebtShareMock');
    DebtShare = await factory.deploy();
  });

  describe('when the election module is initialized', function () {
    before('initialize', async function () {
      const now = await getTime(ethers.provider);
      const epochEndDate = now + daysToSeconds(90);
      const votingPeriodStartDate = epochEndDate - daysToSeconds(7);
      const nominationPeriodStartDate = votingPeriodStartDate - daysToSeconds(7);

      await ElectionModule[
        'initializeElectionModule(string,string,address[],uint8,uint64,uint64,uint64,address)'
      ](
        'Spartan Council Token',
        'SCT',
        [owner.address],
        1,
        nominationPeriodStartDate,
        votingPeriodStartDate,
        epochEndDate,
        DebtShare.address
      );
    });

    it('shows that the election module is initialized', async function () {
      assert.equal(await ElectionModule.isElectionModuleInitialized(), true);
    });

    it('shows that the current epoch index is zero', async function () {
      assertBn.equal(await ElectionModule.getEpochIndex(), 0);
    });

    it('shows that the current period is Administration', async function () {
      assertBn.equal(await ElectionModule.getCurrentPeriod(), ElectionPeriod.Administration);
    });

    it('shows that the DebtShare contract is connected', async function () {
      assert.equal(await ElectionModule.getDebtShareContract(), DebtShare.address);
    });

    describe('before a debt share snapshot is set', function () {
      describe('when trying to retrieve the current debt share snapshot id', function () {
        it('reverts', async function () {
          await assertRevert(
            ElectionModule.getDebtShareSnapshotId(),
            'DebtShareSnapshotIdNotSet'
          );
        });
      });

      describe('when trying to retrieve the current debt share of a user', function () {
        it('reverts', async function () {
          await assertRevert(
            ElectionModule.getDebtShare(user1.address),
            'DebtShareSnapshotIdNotSet'
          );
        });
      });
    });

    describe('before a merkle root is set', function () {
      describe('when trying to retrieve the current cross chain merkle root', function () {
        it('reverts', async function () {
          await assertRevert(
            ElectionModule.getCrossChainDebtShareMerkleRoot(),
            'MerkleRootNotSet'
          );
        });
      });

      describe('when trying to retrieve the current cross chain merkle root block number', function () {
        it('reverts', async function () {
          await assertRevert(
            ElectionModule.getCrossChainDebtShareMerkleRootBlockNumber(),
            'MerkleRootNotSet'
          );
        });
      });

      describe('when trying to retrieve the current cros chain debt share of a user', function () {
        it('reverts', async function () {
          await assertRevert(
            ElectionModule.getDeclaredCrossChainDebtShare(user1.address),
            'MerkleRootNotSet'
          );
        });
      });
    });

    describe('before the nomination period begins', function () {
      describe('when trying to set the debt share id', function () {
        it('reverts', async function () {
          await assertRevert(
            ElectionModule.setDebtShareSnapshotId(0),
            'NotCallableInCurrentPeriod'
          );
        });
      });

      describe('when trying to set the cross chain debt share merkle root', function () {
        it('reverts', async function () {
          await assertRevert(
            ElectionModule.setCrossChainDebtShareMerkleRoot('0x000000000000000000000000000000000000000000000000000000000000beef', 1337),
            'NotCallableInCurrentPeriod'
          );
        });
      });
    });

    describe('when advancing to the nominations period', function () {
      before('fast forward', async function () {
        await fastForwardTo(await ElectionModule.getNominationPeriodStartDate(), ethers.provider);
      });

      describe('when the current epochs debt share snapshot id is set to 42', function () {
        debtShareSnapshotId = 42;

        before('simulate debt share data', async function () {
          await simulateDebtShareData(DebtShare, [user1, user2, user3]);
        });

        before('set snapshot id', async function () {
          const tx = await ElectionModule.setDebtShareSnapshotId(debtShareSnapshotId);
          receipt = await tx.wait();
        });

        it('emitted a DebtShareSnapshotIdSet event', async function () {
          const event = findEvent({ receipt, eventName: 'DebtShareSnapshotIdSet' });

          assert.ok(event);
          assertBn.equal(event.args.snapshotId, debtShareSnapshotId);
        });

        it('shows that the snapshot id is set', async function () {
          assertBn.equal(await ElectionModule.getDebtShareSnapshotId(), debtShareSnapshotId);
        });
      });

      describe.skip('when the current epochs cross chan debt share merkle proof is set', function () {});
    });
  });
});
