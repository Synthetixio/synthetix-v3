import assert from 'node:assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { integrationBootstrap } from './bootstrap';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { ethers } from 'ethers';
import { ElectionPeriod } from '../constants';

describe('SynthetixElectionModule - Elections', () => {
  const { chains } = integrationBootstrap();

  const fastForwardToNominationPeriod = async (provider: ethers.providers.JsonRpcProvider) => {
    const schedule = await chains[0].CoreProxy.getEpochSchedule();
    await fastForwardTo(schedule.nominationPeriodStartDate.toNumber() + 10, provider);
  };

  const fastForwardToVotingPeriod = async (provider: ethers.providers.JsonRpcProvider) => {
    const schedule = await chains[0].CoreProxy.getEpochSchedule();
    await fastForwardTo(schedule.votingPeriodStartDate.toNumber() + 10, provider);
  };

  const addresses = new Array().fill(ethers.Wallet.createRandom(), 0, 5);

  const epochs = [
    {
      index: 0,
      debtShareSnapshotId: 42,
      blockNumber: 21000000,
      winners: () => [addresses[3]!, addresses[4]!],
    },
    {
      index: 1,
      debtShareSnapshotId: 1337,
      blockNumber: 23100007,
      winners: () => [addresses[3]!, addresses[5]!],
    },
    {
      index: 2,
      debtShareSnapshotId: 2192,
      blockNumber: 30043001,
      winners: () => [addresses[5]!, addresses[4]!],
    },
  ];

  describe('when the election module is initialized', async () => {
    const [mothership, satellite1, satellite2] = chains;
    epochs.forEach((epoch) => {
      describe(`epoch ${epoch.index} with debt share snapshot ${epoch.debtShareSnapshotId}`, () => {
        it(`shows that the current epoch index is ${epoch.index}`, async () => {
          assertBn.equal(await mothership.CoreProxy.getEpochIndex(), epoch.index);
        });

        it('shows that the current period is Administration', async () => {
          assertBn.equal(
            await mothership.CoreProxy.getCurrentPeriod(),
            ElectionPeriod.Administration
          );
        });

        describe('when trying to retrieve the current debt share of a user', () => {
          it('returns zero', async () => {
            assertBn.equal(await mothership.CoreProxy.getVotePower(addresses[0]!, 1115111, 0), 0);
            assertBn.equal(await mothership.CoreProxy.getVotePower(addresses[0]!, 420, 0), 0);
            assertBn.equal(await mothership.CoreProxy.getVotePower(addresses[0]!, 43113, 0), 0);
          });
        });
      });

      describe('before the nomination period begins', () => {
        describe('when trying to set the debt share id', () => {
          it('reverts', async () => {
            await assertRevert(
              mothership.CoreProxy.takeVotePowerSnapshot(mothership.SnapshotRecordMock.address),
              'NotCallableInCurrentPeriod'
            );
            await assertRevert(
              satellite1.CoreProxy.takeVotePowerSnapshot(satellite1.SnapshotRecordMock.address),
              'NotCallableInCurrentPeriod'
            );
            await assertRevert(
              satellite1.CoreProxy.takeVotePowerSnapshot(satellite2.SnapshotRecordMock.address),
              'NotCallableInCurrentPeriod'
            );
          });
        });

        describe('when trying to prepare the ballot with snapshots', () => {
          it('reverts', async () => {
            await assertRevert(
              mothership.CoreProxy.prepareBallotWithSnapshot(
                mothership.SnapshotRecordMock.address,
                addresses[0]
              ),
              'NotCallableInCurrentPeriod'
            );
            await assertRevert(
              satellite1.CoreProxy.prepareBallotWithSnapshot(
                satellite1.SnapshotRecordMock.address,
                addresses[0]
              ),
              'NotCallableInCurrentPeriod'
            );
            await assertRevert(
              satellite2.CoreProxy.prepareBallotWithSnapshot(
                satellite2.SnapshotRecordMock.address,
                addresses[0]
              ),
              'NotCallableInCurrentPeriod'
            );
          });
        });

        describe('when trying to set the snapshot contract', () => {
          it('reverts', async () => {
            await assertRevert(
              mothership.CoreProxy.setSnapshotContract(mothership.SnapshotRecordMock.address, true),
              'NotCallableInCurrentPeriod'
            );
            await assertRevert(
              satellite1.CoreProxy.setSnapshotContract(satellite1.SnapshotRecordMock.address, true),
              'NotCallableInCurrentPeriod'
            );
            await assertRevert(
              satellite2.CoreProxy.setSnapshotContract(satellite2.SnapshotRecordMock.address, true),
              'NotCallableInCurrentPeriod'
            );
          });
        });
      });

      describe('when advancing to the nominations period', () => {
        before('set snapshot contract', async () => {
          await mothership.CoreProxy.setSnapshotContract(
            mothership.SnapshotRecordMock.address,
            true
          );
          await satellite1.CoreProxy.setSnapshotContract(
            satellite1.SnapshotRecordMock.address,
            true
          );
          await satellite2.CoreProxy.setSnapshotContract(
            satellite2.SnapshotRecordMock.address,
            true
          );
        });

        before('fast forward', async () => {
          await fastForwardToNominationPeriod(mothership.provider);
          await fastForwardToNominationPeriod(satellite1.provider);
          await fastForwardToNominationPeriod(satellite2.provider);
        });

        before('simulate debt share data', async () => {
          //prepare voting for satellite1
          const snapshotId1 = await satellite1.CoreProxy.callStatic.takeVotePowerSnapshot(
            satellite1.SnapshotRecordMock.address
          );
          await satellite1.CoreProxy.takeVotePowerSnapshot(satellite1.SnapshotRecordMock.address);

          addresses.map(async (address) => {
            await satellite1.SnapshotRecordMock.setBalanceOfOnPeriod(
              address,
              ethers.utils.parseEther('100'),
              snapshotId1.add(1).toString()
            );
          });

          //prepare voting for satellite2
          const snapshotId2 = await satellite2.CoreProxy.callStatic.takeVotePowerSnapshot(
            satellite2.SnapshotRecordMock.address
          );
          await satellite2.CoreProxy.takeVotePowerSnapshot(satellite2.SnapshotRecordMock.address);
          addresses.map(async (address) => {
            await satellite2.SnapshotRecordMock.setBalanceOfOnPeriod(
              address,
              ethers.utils.parseEther('100'),
              snapshotId2.add(1).toString()
            );
          });
        });

        it('shows that the current period is Nomination', async () => {
          assertBn.equal(await mothership.CoreProxy.getCurrentPeriod(), ElectionPeriod.Nomination);
        });

        it('shows that the snapshot id is set', async function () {
          assertBn.equal(
            await mothership.CoreProxy.getVotePowerSnapshotId(
              mothership.SnapshotRecordMock.address,
              epoch.index
            ),
            epoch.debtShareSnapshotId
          );

          assertBn.equal(
            await satellite1.CoreProxy.getVotePowerSnapshotId(
              mothership.SnapshotRecordMock.address,
              epoch.index
            ),
            epoch.debtShareSnapshotId
          );

          assertBn.equal(
            await satellite2.CoreProxy.getVotePowerSnapshotId(
              mothership.SnapshotRecordMock.address,
              epoch.index
            ),
            epoch.debtShareSnapshotId
          );
        });

        describe('when cross chain debt share data is collected', () => {
          describe('when a user attempts to declare cross chain debt shares and the merkle root is not set', () => {
            let snapshotIdMotherShipChain: number;
            let snapshotIdSatellite1: number;
            let snapshotIdSatellite2: number;
            before('take snapshot', async () => {
              snapshotIdMotherShipChain = (
                await mothership.CoreProxy.getVotePowerSnapshotId(
                  mothership.SnapshotRecordMock.address,
                  epoch.index
                )
              ).toNumber();

              snapshotIdSatellite1 = (
                await satellite1.CoreProxy.getVotePowerSnapshotId(
                  mothership.SnapshotRecordMock.address,
                  epoch.index
                )
              ).toNumber();

              snapshotIdSatellite2 = (
                await satellite2.CoreProxy.getVotePowerSnapshotId(
                  mothership.SnapshotRecordMock.address,
                  epoch.index
                )
              ).toNumber();
            });

            before('fast forward', async () => {
              await fastForwardToVotingPeriod(mothership.provider);
              await fastForwardToVotingPeriod(satellite1.provider);
              await fastForwardToVotingPeriod(satellite2.provider);
            });
          });

          before('nominate', async () => {
            await (await mothership.CoreProxy.connect(addresses[3]).nominate()).wait();
            await (await mothership.CoreProxy.connect(addresses[4]).nominate()).wait();
            await (await mothership.CoreProxy.connect(addresses[5]).nominate()).wait();
            await (await mothership.CoreProxy.connect(addresses[6]).nominate()).wait();
            await (await mothership.CoreProxy.connect(addresses[7]).nominate()).wait();
            await (await mothership.CoreProxy.connect(addresses[8]).nominate()).wait();
          });

          describe('when users declare their debt shares in the wrong period', () => {
            it('reverts', async () => {
              await assertRevert(
                mothership.CoreProxy.prepareBallotWithSnapshot(
                  mothership.SnapshotRecordMock.address,
                  addresses[0]
                ),
                'NotCallableInCurrentPeriod'
              );
              await assertRevert(
                satellite2.CoreProxy.prepareBallotWithSnapshot(
                  mothership.SnapshotRecordMock.address,
                  addresses[0]
                ),
                'NotCallableInCurrentPeriod'
              );
              await assertRevert(
                satellite2.CoreProxy.prepareBallotWithSnapshot(
                  satellite2.SnapshotRecordMock.address,
                  addresses[0]
                ),
                'NotCallableInCurrentPeriod'
              );
            });
          });

          describe('when advancing to the voting period', () => {
            before('fast forward', async () => {
              await fastForwardToVotingPeriod(mothership.provider);
              await fastForwardToVotingPeriod(satellite1.provider);
              await fastForwardToVotingPeriod(satellite2.provider);
            });

            it('shows that the current period is Voting', async () => {
              assertBn.equal(await mothership.CoreProxy.getCurrentPeriod(), ElectionPeriod.Vote);
            });

            describe('when users declare their cross chain debt shares incorrectly', () => {
              describe('when a user uses the wrong tree to declare', () => {
                it('reverts', async () => {
                  await assertRevert(
                    mothership.CoreProxy.prepareBallotWithSnapshot(
                      mothership.SnapshotRecordMock.address,
                      ethers.Wallet.createRandom().address
                    ),
                    'NoPower'
                  );
                  await assertRevert(
                    satellite1.CoreProxy.prepareBallotWithSnapshot(
                      satellite1.SnapshotRecordMock.address,
                      ethers.Wallet.createRandom().address
                    ),
                    'NoPower'
                  );
                  await assertRevert(
                    satellite2.CoreProxy.prepareBallotWithSnapshot(
                      satellite2.SnapshotRecordMock.address,
                      ethers.Wallet.createRandom().address
                    ),
                    'NoPower'
                  );
                });
              });
            });

            describe('when users declare their cross chain debt shares correctly', () => {
              before('declare', async () => {
                await mothership.CoreProxy.prepareBallotWithSnapshot(
                  mothership.SnapshotRecordMock.address,
                  addresses[0]
                );
                await mothership.CoreProxy.prepareBallotWithSnapshot(
                  mothership.SnapshotRecordMock.address,
                  addresses[1]
                );
                await satellite1.CoreProxy.prepareBallotWithSnapshot(
                  satellite1.SnapshotRecordMock.address,
                  addresses[0]
                );
                await satellite1.CoreProxy.prepareBallotWithSnapshot(
                  satellite1.SnapshotRecordMock.address,
                  addresses[1]
                );
                await satellite2.CoreProxy.prepareBallotWithSnapshot(
                  satellite2.SnapshotRecordMock.address,
                  addresses[0]
                );
                await satellite2.CoreProxy.prepareBallotWithSnapshot(
                  satellite2.SnapshotRecordMock.address,
                  addresses[1]
                );
              });

              describe('when a user attempts to re-declare debt shares', () => {
                it('reverts', async () => {
                  await assertRevert(
                    mothership.CoreProxy.prepareBallotWithSnapshot(
                      mothership.SnapshotRecordMock.address,
                      addresses[0]
                    ),
                    'BallotAlreadyPrepared'
                  );
                  await assertRevert(
                    satellite1.CoreProxy.prepareBallotWithSnapshot(
                      satellite1.SnapshotRecordMock.address,
                      addresses[0]
                    ),
                    'BallotAlreadyPrepared'
                  );
                  await assertRevert(
                    satellite2.CoreProxy.prepareBallotWithSnapshot(
                      satellite2.SnapshotRecordMock.address,
                      addresses[0]
                    ),
                    'BallotAlreadyPrepared'
                  );
                });
              });

              describe('when users cast votes', () => {
                let ballot1: string;
                let ballot2: string;
                let ballot3: string;

                before('vote', async () => {
                  await mothership.CoreProxy.connect(addresses[0]).cast(
                    [addresses[3]],
                    [ethers.utils.parseEther('100')]
                  );
                  await mothership.CoreProxy.connect(addresses[1]).cast(
                    [addresses[3]],
                    [ethers.utils.parseEther('100')]
                  );
                  await mothership.CoreProxy.connect(addresses[2]).cast(
                    [addresses[4]],
                    [ethers.utils.parseEther('100')]
                  ); // users[2]! didn't declare cross chain debt shares yet
                  await mothership.CoreProxy.connect(addresses[3]).cast(
                    [addresses[5]],
                    [ethers.utils.parseEther('100')]
                  );
                  await mothership.CoreProxy.connect(addresses[4]).cast(
                    [addresses[3]],
                    [ethers.utils.parseEther('100')]
                  );
                });

                it('keeps track of which ballot each user voted on', async () => {
                  assert.equal(await mothership.CoreProxy.getBallotVoted(addresses[0]!), ballot1);
                  assert.equal(await c.CoreProxy.getBallotVoted(addresses[1]!), ballot1);
                  assert.equal(await c.CoreProxy.getBallotVoted(addresses[2]!), ballot2);
                  assert.equal(await c.CoreProxy.getBallotVoted(addresses[3]!), ballot3);
                  assert.equal(await c.CoreProxy.getBallotVoted(addresses[4]!), ballot1);
                });

                it('keeps track of the candidates of each ballot', async function () {
                  assert.deepEqual(
                    await mothership.CoreProxy.getBallotCandidates(
                      addresses[0],
                      11155111,
                      epoch.index
                    ),
                    [addresses[3]]
                  );
                  assert.deepEqual(
                    await mothership.CoreProxy.getBallotCandidates(
                      addresses[1],
                      11155111,
                      epoch.index
                    ),
                    [addresses[3]]
                  );
                  assert.deepEqual(
                    await mothership.CoreProxy.getBallotCandidates(
                      addresses[2],
                      11155111,
                      epoch.index
                    ),
                    [addresses[4]]
                  );
                  assert.deepEqual(
                    await mothership.CoreProxy.getBallotCandidates(
                      addresses[3],
                      11155111,
                      epoch.index
                    ),
                    [addresses[5]]
                  );
                  assert.deepEqual(
                    await mothership.CoreProxy.getBallotCandidates(
                      addresses[4],
                      11155111,
                      epoch.index
                    ),
                    [addresses[3]]
                  );
                });

                it('keeps track of vote power in each ballot', async function () {
                  const votesBallot1 = (
                    await expectedVotePower(users[0]!, epoch.debtShareSnapshotId)
                  )
                    .add(await expectedVotePower(users[1]!, epoch.debtShareSnapshotId))
                    .add(await expectedVotePower(users[4]!, epoch.debtShareSnapshotId));
                  const votesBallot2 = await expectedVotePower(
                    users[2]!,
                    epoch.debtShareSnapshotId
                  );
                  const votesBallot3 = await expectedVotePower(
                    users[3]!,
                    epoch.debtShareSnapshotId
                  );

                  assertBn.equal(await c.CoreProxy.getBallotVotes(ballot1), votesBallot1);
                  assertBn.equal(await c.CoreProxy.getBallotVotes(ballot2), votesBallot2);
                  assertBn.equal(await c.CoreProxy.getBallotVotes(ballot3), votesBallot3);
                });

                describe('when voting ends', function () {
                  before('fast forward', async function () {
                    const schedule = await c.CoreProxy.getEpochSchedule();
                    await fastForwardTo(schedule.endDate.toNumber(), getProvider());
                  });

                  it('shows that the current period is Evaluation', async function () {
                    assertBn.equal(await c.CoreProxy.getCurrentPeriod(), ElectionPeriod.Evaluation);
                  });

                  describe('when the election is evaluated', function () {
                    let rx: ethers.ContractReceipt;

                    before('evaluate', async function () {
                      rx = await (await c.CoreProxy.evaluate(0)).wait();
                    });

                    it('emits the event ElectionEvaluated', async function () {
                      await assertEvent(rx, `ElectionEvaluated(${epoch.index}, 3)`, c.CoreProxy);
                    });

                    it('shows that the election is evaluated', async function () {
                      assert.equal(await c.CoreProxy.isElectionEvaluated(), true);
                    });

                    it('shows each candidates votes', async function () {
                      const votesUser4 = (
                        await expectedVotePower(users[0]!, epoch.debtShareSnapshotId)
                      )
                        .add(await expectedVotePower(users[1]!, epoch.debtShareSnapshotId))
                        .add(await expectedVotePower(users[4]!, epoch.debtShareSnapshotId));
                      const votesUser5 = await expectedVotePower(
                        users[2]!,
                        epoch.debtShareSnapshotId
                      );
                      const votesUser6 = await expectedVotePower(
                        users[3]!,
                        epoch.debtShareSnapshotId
                      );

                      assertBn.equal(
                        await c.CoreProxy.getCandidateVotes(addresses[3]!),
                        votesUser4
                      );
                      assertBn.equal(
                        await c.CoreProxy.getCandidateVotes(addresses[4]!),
                        votesUser5
                      );
                      assertBn.equal(
                        await c.CoreProxy.getCandidateVotes(addresses[5]!),
                        votesUser6
                      );
                      assertBn.equal(await c.CoreProxy.getCandidateVotes(addresses[6]!), 0);
                      assertBn.equal(await c.CoreProxy.getCandidateVotes(addresses[7]!), 0);
                      assertBn.equal(await c.CoreProxy.getCandidateVotes(addresses[8]!), 0);
                    });

                    it('shows the election winners', async function () {
                      assert.deepEqual(await c.CoreProxy.getElectionWinners(), epoch.winners());
                    });

                    describe('when the election is resolved', function () {
                      before('resolve', async function () {
                        await (await c.CoreProxy.resolve()).wait();
                      });

                      it('shows the expected NFT owners', async function () {
                        const winners = epoch.winners();

                        assertBn.equal(
                          await c.CouncilToken.balanceOf(await owner.getAddress()),
                          winners.includes(await owner.getAddress()) ? 1 : 0
                        );
                        assertBn.equal(
                          await c.CouncilToken.balanceOf(addresses[3]!),
                          winners.includes(addresses[3]!) ? 1 : 0
                        );
                        assertBn.equal(
                          await c.CouncilToken.balanceOf(addresses[4]!),
                          winners.includes(addresses[4]!) ? 1 : 0
                        );
                        assertBn.equal(
                          await c.CouncilToken.balanceOf(addresses[5]!),
                          winners.includes(addresses[5]!) ? 1 : 0
                        );
                        assertBn.equal(
                          await c.CouncilToken.balanceOf(addresses[6]!),
                          winners.includes(addresses[6]!) ? 1 : 0
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
    });
  });
});
