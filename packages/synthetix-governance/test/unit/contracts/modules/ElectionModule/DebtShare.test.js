const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { daysToSeconds } = require('@synthetixio/core-js/utils/misc/dates');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../../../helpers/initializer');
const {
  simulateDebtShareData,
  expectedDebtShare,
  expectedVotePower,
} = require('./helpers/debt-share-helper');
const { ElectionPeriod } = require('@synthetixio/core-modules/test/contracts/modules/ElectionModule/helpers/election-helper');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');
const { getTime, fastForwardTo } = require('@synthetixio/core-js/utils/hardhat/rpc');

describe('SynthetixElectionModule (debt share)', () => {
  const { proxyAddress } = bootstrap(initializer);

  let owner, user1, user2, user3;

  let ElectionModule, DebtShare;

  let receipt;

  async function nominate(signer) {
    const tx = await ElectionModule.connect(signer).nominate();
    receipt = await tx.wait();
  }

  async function withdrawNomination(signer) {
    const tx = await ElectionModule.connect(signer).withdrawNomination();
    receipt = await tx.wait();
  }

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

  describe('when the module is initialized', function () {
    before('deploy debt shares mock', async function () {
      const factory = await ethers.getContractFactory('DebtShareMock');
      DebtShare = await factory.deploy();
    });

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

    it('set the debt share contract', async function () {
      assert.equal(await ElectionModule.getDebtShareContract(), DebtShare.address);
    });

    describe('when changing the debt share contract', function () {
      describe('with an account that does not own the instance', function () {
        it('reverts', async function () {
          await assertRevert(
            ElectionModule.connect(user1).setDebtShareContract(
              '0x0000000000000000000000000000000000000001'
            ),
            'Unauthorized'
          );
        });
      });

      describe('with an account that owns the instance', function () {
        before('deploy debt shares mock', async function () {
          const factory = await ethers.getContractFactory('DebtShareMock');
          DebtShare = await factory.deploy();
        });

        before('set the new debt share contract', async function () {
          const tx = await ElectionModule.setDebtShareContract(DebtShare.address);
          receipt = await tx.wait();
        });

        it('emitted a DebtShareContractSet event', async function () {
          const event = findEvent({ receipt, eventName: 'DebtShareContractSet' });

          assert.ok(event);
          assertBn.equal(event.args.debtShareContractAddress, DebtShare.address);
        });
      });
    });

    describe('when using debt shares to calculate user vote power', function () {
      before('simulate some debt share data', async function () {
        await simulateDebtShareData(DebtShare, [user1, user2, user3]);
      });

      describe('before the debt share snapshot id is set', function () {
        it('shows that user vote power is zero', async function () {
          assertBn.equal(await ElectionModule.getVotePower(user1.address), 0);
          assertBn.equal(await ElectionModule.getVotePower(user2.address), 0);
          assertBn.equal(await ElectionModule.getVotePower(user3.address), 0);
        });
      });

      describe('during the administration period', function () {
        describe('when trying to set the debtShareSnapshotId', function () {
          it('reverts', async function () {
            await assertRevert(
              ElectionModule.setDebtShareSnapshotId(666),
              'NotCallableInCurrentPeriod'
            );
          });
        });
      });

      describe('when entering the nomination period', function () {
        before('fast forward', async function () {
          await fastForwardTo(await ElectionModule.getNominationPeriodStartDate(), ethers.provider);
        });

        it('shows that the current period is Nomination', async function () {
          assertBn.equal(await ElectionModule.getCurrentPeriod(), ElectionPeriod.Nomination);
        });

        function itReflectsTheDebtSharePeriod(debtShareSnapshotId) {
          it('emitted a DebtShareSnapshotIdSet event', async function () {
            const event = findEvent({ receipt, eventName: 'DebtShareSnapshotIdSet' });

            assert.ok(event);
            assertBn.equal(event.args.snapshotId, debtShareSnapshotId);
          });

          it('shows that the user has the expected debt shares', async function () {
            assert.deepEqual(
              await ElectionModule.getDebtShare(user1.address),
              expectedDebtShare(user1.address, debtShareSnapshotId)
            );
            assert.deepEqual(
              await ElectionModule.getDebtShare(user2.address),
              expectedDebtShare(user2.address, debtShareSnapshotId)
            );
            assert.deepEqual(
              await ElectionModule.getDebtShare(user3.address),
              expectedDebtShare(user3.address, debtShareSnapshotId)
            );
          });

          it('shows that the user has the expected vote power', async function () {
            assert.deepEqual(
              await ElectionModule.getVotePower(user1.address),
              expectedVotePower(user1.address, debtShareSnapshotId)
            );
            assert.deepEqual(
              await ElectionModule.getVotePower(user2.address),
              expectedVotePower(user2.address, debtShareSnapshotId)
            );
            assert.deepEqual(
              await ElectionModule.getVotePower(user3.address),
              expectedVotePower(user3.address, debtShareSnapshotId)
            );
          });
        }

        describe('when the debt share snapshot id is set to 42', async function () {
          before('take snapshot', async function () {
            const tx = await ElectionModule.setDebtShareSnapshotId(42);
            receipt = await tx.wait();
          });

          itReflectsTheDebtSharePeriod(42);
        });

        describe('when the debt share snapshot id is set to 1337', async function () {
          before('take snapshot', async function () {
            const tx = await ElectionModule.setDebtShareSnapshotId(1337);
            receipt = await tx.wait();
          });

          itReflectsTheDebtSharePeriod(1337);
        });

        describe('when the debt share snapshot id is set to 2192', async function () {
          before('take snapshot', async function () {
            const tx = await ElectionModule.setDebtShareSnapshotId(2192);
            receipt = await tx.wait();
          });

          itReflectsTheDebtSharePeriod(2192);
        });
      });

      describe('when entering the voting period', function () {
        before('fast forward', async function () {
          await fastForwardTo(await ElectionModule.getVotingPeriodStartDate(), ethers.provider);
        });

        it('shows that the current period is Voting', async function () {
          assertBn.equal(await ElectionModule.getCurrentPeriod(), ElectionPeriod.Vote);
        });

        describe('when trying to set the debtShareSnapshotId', function () {
          it('reverts', async function () {
            await assertRevert(
              ElectionModule.setDebtShareSnapshotId(666),
              'NotCallableInCurrentPeriod'
            );
          });
        });
      });

      describe('when entering the evaluation period', function () {
        before('fast forward', async function () {
          await fastForwardTo(await ElectionModule.getEpochEndDate(), ethers.provider);
        });

        it('shows that the current period is Evaluating', async function () {
          assertBn.equal(await ElectionModule.getCurrentPeriod(), ElectionPeriod.Evaluation);
        });

        describe('when trying to set the debtShareSnapshotId', function () {
          it('reverts', async function () {
            await assertRevert(
              ElectionModule.setDebtShareSnapshotId(666),
              'NotCallableInCurrentPeriod'
            );
          });
        });
      });
    });
  });
});
