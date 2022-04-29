const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const { daysToSeconds } = require('@synthetixio/core-js/utils/misc/dates');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../../helpers/initializer');
const {
  ElectionPeriod,
  expectedVotePowerForDebtSharePeriodId,
} = require('./helpers/election-helper');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');
const { runElection } = require('./helpers/election-helper');
const { getTime, fastForwardTo } = require('@synthetixio/core-js/utils/hardhat/rpc');

describe('ElectionModule (debt share)', () => {
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

    describe('on the first epoch', function () {
      describe('when entering the nomination period', function () {
        before('fast forward', async function () {
          await fastForwardTo(await ElectionModule.getNominationPeriodStartDate(), ethers.provider);
        });

        it('shows that the current period is Nomination', async function () {
          assertBn.equal(await ElectionModule.getCurrentPeriod(), ElectionPeriod.Nomination);
        });

        it('shows that the debt share snapshot is 0', async function () {
          assertBn.equal(await DebtShare.currentPeriodId(), 0);
        });

        it('shows that the current epoch is 1', async function () {
          assertBn.equal(await ElectionModule.getEpochIndex(), 1);
        });

        it('shows that the user has the expected vote power', async function () {
          assertBn.equal(
            await ElectionModule.getVotePower(user1.address),
            await expectedVotePowerForDebtSharePeriodId(0)
          );
        });

        describe('on the first nomination', function () {
          before('nominate', async function () {
            await nominate(user1);
          });

          it('emitted an DebtShareSnapshotTaken event', async function () {
            const event = findEvent({ receipt, eventName: 'DebtShareSnapshotTaken' });

            assert.ok(event);
            assertBn.equal(event.args.snapshotId, 1);
          });

          it('shows that the debt share snapshot is now 1', async function () {
            assertBn.equal(await DebtShare.currentPeriodId(), 1);
          });

          it('shows that has the expected vote power', async function () {
            assertBn.equal(
              await ElectionModule.getVotePower(user1.address),
              await expectedVotePowerForDebtSharePeriodId(1)
            );
          });

          describe('upon further nominations', function () {
            before('nominate', async function () {
              await nominate(user2);
              await nominate(user3);
            });

            it('did not emit a DebtShareSnapshotTaken event', async function () {
              const event = findEvent({ receipt, eventName: 'DebtShareSnapshotTaken' });

              assert.equal(event, undefined);
            });
          });

          describe('when the election is finalized', function () {
            before('close epoch', async function () {
              await withdrawNomination(user1);
              await withdrawNomination(user2);
              await withdrawNomination(user3);

              receipt = await runElection(ElectionModule, owner, [user1]);
            });

            describe('on the second epoch', function () {
              before('fast forward', async function () {
                await fastForwardTo(
                  await ElectionModule.getNominationPeriodStartDate(),
                  ethers.provider
                );
              });

              it('shows that the current period is Nomination', async function () {
                assertBn.equal(await ElectionModule.getCurrentPeriod(), ElectionPeriod.Nomination);
              });

              it('shows that the debt share snapshot is 1', async function () {
                assertBn.equal(await DebtShare.currentPeriodId(), 1);
              });

              it('shows that the current epoch is 2', async function () {
                assertBn.equal(await ElectionModule.getEpochIndex(), 2);
              });

              describe('when entering the nomination period', function () {
                describe('on the first nomination of the next epoch', function () {
                  before('nominate', async function () {
                    await nominate(user2);
                  });

                  it('emitted an DebtShareSnapshotTaken event', async function () {
                    const event = findEvent({ receipt, eventName: 'DebtShareSnapshotTaken' });

                    assert.ok(event);
                    assertBn.equal(event.args.snapshotId, 2);
                  });

                  it('shows that the debt share snapshot is now 1', async function () {
                    assertBn.equal(await DebtShare.currentPeriodId(), 2);
                  });

                  it('shows that has the expected vote power', async function () {
                    assertBn.equal(
                      await ElectionModule.getVotePower(user1.address),
                      await expectedVotePowerForDebtSharePeriodId(2)
                    );
                  });

                  describe('upon further nominations', function () {
                    before('nominate', async function () {
                      await nominate(user1);
                      await nominate(user3);
                    });

                    it('did not emit a DebtShareSnapshotTaken event', async function () {
                      const event = findEvent({ receipt, eventName: 'DebtShareSnapshotTaken' });

                      assert.equal(event, undefined);
                    });
                  });

                  describe('when the election is finalized', function () {
                    before('close epoch', async function () {
                      await withdrawNomination(user1);
                      await withdrawNomination(user2);
                      await withdrawNomination(user3);

                      receipt = await runElection(ElectionModule, owner, [user2]);
                    });

                    it('shows that the current epoch is 2', async function () {
                      assertBn.equal(await ElectionModule.getEpochIndex(), 3);
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});
