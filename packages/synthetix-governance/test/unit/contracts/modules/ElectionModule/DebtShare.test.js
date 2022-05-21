const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const { daysToSeconds } = require('@synthetixio/core-js/utils/misc/dates');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../../../helpers/initializer');
const { simulateDebtShareData, expectedVotePower } = require('./helpers/debt-share-helper');
const { ElectionPeriod, runElection } = require('@synthetixio/core-modules/test/contracts/modules/ElectionModule/helpers/election-helper');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');
const { getTime, fastForwardTo } = require('@synthetixio/core-js/utils/hardhat/rpc');

describe.only('SynthetixElectionModule (debt share)', () => {
  const { proxyAddress } = bootstrap(initializer);

  let owner, user1, user2, user3;

  let ElectionModule, DebtShare;

  let snapshotId;

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

    before('simulate some debt share data', async function () {
      await simulateDebtShareData(DebtShare, [user1, user2, user3]);
    });

    describe('on the first epoch', function () {
      it('shows that the current epoch is 0', async function () {
        assertBn.equal(await ElectionModule.getEpochIndex(), 0);
      });

      describe('before the debt share snapshot id is set', function () {
        it('shows that user vote power is zero', async function () {
          assertBn.equal(await ElectionModule.getVotePower(user1.address), 0);
          assertBn.equal(await ElectionModule.getVotePower(user2.address), 0);
          assertBn.equal(await ElectionModule.getVotePower(user3.address), 0);
        });
      });

      describe('when entering the nomination period', function () {
        before('fast forward', async function () {
          await fastForwardTo(await ElectionModule.getNominationPeriodStartDate(), ethers.provider);
        });

        it('shows that the current period is Nomination', async function () {
          assertBn.equal(await ElectionModule.getCurrentPeriod(), ElectionPeriod.Nomination);
        });

        describe('when the debt share snapshot id is set', async function () {
          before('take snapshot', async function () {
            snapshotId = 42;

            const tx = await ElectionModule.setDebtShareSnapshotId(snapshotId);
            receipt = await tx.wait();
          });

          it('emitted a DebtShareSnapshotIdSet event', async function () {
              const event = findEvent({ receipt, eventName: 'DebtShareSnapshotIdSet' });

              assert.ok(event);
              assertBn.equal(event.args.snapshotId, snapshotId);
          });

          it('shows that the user has the expected vote power', async function () {
            assert.deepEqual(await ElectionModule.getVotePower(user1.address), expectedVotePower(user1.address, snapshotId));
            assert.deepEqual(await ElectionModule.getVotePower(user2.address), expectedVotePower(user2.address, snapshotId));
            assert.deepEqual(await ElectionModule.getVotePower(user3.address), expectedVotePower(user3.address, snapshotId));
          });
        });

    //     describe('when nominations exist', function () {
    //       before('nominate', async function () {
    //         await nominate(user1);
    //         await nominate(user2);
    //         await nominate(user3);
    //       });
    //     });

    //     describe('when the election is finalized', function () {
    //       before('close epoch', async function () {
    //         await withdrawNomination(user1);
    //         await withdrawNomination(user2);
    //         await withdrawNomination(user3);

    //         receipt = await runElection(ElectionModule, owner, [user1]);
    //       });

    //       describe('on the second epoch', function () {
    //         before('fast forward', async function () {
    //           await fastForwardTo(
    //             await ElectionModule.getNominationPeriodStartDate(),
    //             ethers.provider
    //           );
    //         });

    //         it('shows that the current period is Nomination', async function () {
    //           assertBn.equal(await ElectionModule.getCurrentPeriod(), ElectionPeriod.Nomination);
    //         });

    //         it('shows that the debt share snapshot is 1', async function () {
    //           assertBn.equal(await DebtShare.currentPeriodId(), 1);
    //         });

    //         it('shows that the current epoch is 1', async function () {
    //           assertBn.equal(await ElectionModule.getEpochIndex(), 1);
    //         });

    //         describe('when entering the nomination period', function () {
    //           describe('on the first nomination of the next epoch', function () {
    //             before('nominate', async function () {
    //               await nominate(user2);
    //             });

    //             it('emitted an DebtShareSnapshotTaken event', async function () {
    //               const event = findEvent({ receipt, eventName: 'DebtShareSnapshotTaken' });

    //               assert.ok(event);
    //               assertBn.equal(event.args.snapshotId, 2);
    //             });

    //             it('shows that the debt share snapshot is now 1', async function () {
    //               assertBn.equal(await DebtShare.currentPeriodId(), 2);
    //             });

    //             it('shows that has the expected vote power', async function () {
    //               assertBn.equal(
    //                 await ElectionModule.getVotePower(user1.address),
    //                 await expectedVotePowerForDebtSharePeriodId(2)
    //               );
    //             });

    //             describe('upon further nominations', function () {
    //               before('nominate', async function () {
    //                 await nominate(user1);
    //                 await nominate(user3);
    //               });

    //               it('did not emit a DebtShareSnapshotTaken event', async function () {
    //                 const event = findEvent({ receipt, eventName: 'DebtShareSnapshotTaken' });

    //                 assert.equal(event, undefined);
    //               });
    //             });

    //             describe('when the election is finalized', function () {
    //               before('close epoch', async function () {
    //                 await withdrawNomination(user1);
    //                 await withdrawNomination(user2);
    //                 await withdrawNomination(user3);

    //                 receipt = await runElection(ElectionModule, owner, [user2]);
    //               });

    //               it('shows that the current epoch is 2', async function () {
    //                 assertBn.equal(await ElectionModule.getEpochIndex(), 2);
    //               });
    //             });
    //           });
    //         });
    //       });
    //     });
      });
    });
  });
});
