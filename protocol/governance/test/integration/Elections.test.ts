import assert from 'node:assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { ethers } from 'ethers';
import { ElectionPeriod } from '../constants';
import { integrationBootstrap, WormholeChainSelector } from './bootstrap';

function generateRandomAddresses() {
  const wallets = [];
  for (let i = 0; i < 10; i++) {
    wallets.push(ethers.Wallet.createRandom());
  }
  return wallets;
}

describe('SynthetixElectionModule - Elections', () => {
  const { chains } = integrationBootstrap();

  const fastForwardToNominationPeriod = async (provider: ethers.providers.JsonRpcProvider) => {
    const schedule = await chains.mothership.GovernanceProxy.getEpochSchedule();
    await fastForwardTo(schedule.nominationPeriodStartDate.toNumber() + 10, provider);
  };

  const fastForwardToVotingPeriod = async (provider: ethers.providers.JsonRpcProvider) => {
    const schedule = await chains.mothership.GovernanceProxy.getEpochSchedule();
    await fastForwardTo(schedule.votingPeriodStartDate.toNumber() + 10, provider);
  };

  const fastForwardToEvaluationPeriod = async (provider: ethers.providers.JsonRpcProvider) => {
    const schedule = await chains.mothership.GovernanceProxy.getEpochSchedule();
    await fastForwardTo(schedule.endDate.add(10).toNumber(), provider);
  };

  const addresses = generateRandomAddresses();

  const epochs = [
    {
      index: 0,
      blockNumber: 21000000,
      winners: () => [addresses[3].address],
    },
    {
      index: 1,
      blockNumber: 23100007,
      winners: () => [addresses[3].address],
    },
    {
      index: 2,
      blockNumber: 30043001,
      winners: () => [addresses[5].address],
    },
  ];

  const deliverResolve = async (rx: ethers.ContractReceipt) => {
    // TODO use json abi here
    const abi = [
      'event LogMessagePublished(address indexed sender, uint64 sequence, uint32 nonce, bytes payload, uint8 consistencyLevel)',
    ];
    const iface = new ethers.utils.Interface(abi);
    const events: ethers.utils.LogDescription[] = [];

    // Parsing the events from the receipt
    rx.events!.forEach((_event) => {
      try {
        events.push(iface.parseLog(_event));
      } catch {
        // Handle the case where the event does not match the ABI
      }
    });

    const encodedValue1 = ethers.utils.defaultAbiCoder.encode(
      ['address', 'uint16', 'uint64'], // Types
      [
        chains.mothership.GovernanceProxy.address,
        WormholeChainSelector.mothership,
        events[0]?.args?.sequence,
      ] // Values
    );
    const encodedValue2 = ethers.utils.defaultAbiCoder.encode(
      ['address', 'uint16', 'uint64'], // Types
      [
        chains.mothership.GovernanceProxy.address,
        WormholeChainSelector.mothership,
        events[1]?.args?.sequence,
      ] // Values
    );

    // request delivery from wormhole standard relayer on the satellite chains
    await chains.satellite1.WormholeRelayerMock.deliver(
      [encodedValue1],
      events[0]?.args?.payload,
      await chains.satellite1.GovernanceProxy.address,
      []
    );
    await chains.satellite2.WormholeRelayerMock.deliver(
      [encodedValue2],
      events[1]?.args?.payload,
      await chains.satellite2.GovernanceProxy.address,
      []
    );
  };

  before('set snapshot contract', async () => {
    const { mothership, satellite1, satellite2 } = chains;
    await mothership.GovernanceProxy.setSnapshotContract(
      mothership.SnapshotRecordMock.address,
      0,
      ethers.utils.parseEther('0'),
      true
    );
    await satellite1.GovernanceProxy.setSnapshotContract(
      satellite1.SnapshotRecordMock.address,
      0,
      ethers.utils.parseEther('0'),
      true
    );
    await satellite2.GovernanceProxy.setSnapshotContract(
      satellite2.SnapshotRecordMock.address,
      0,
      ethers.utils.parseEther('0'),
      true
    );
  });

  before('fund addresses', async () => {
    await Promise.all(
      Object.values(chains).map(async (chain) => {
        return addresses.map(async (wallet) => {
          return await chain.provider.send('hardhat_setBalance', [
            wallet.address,
            `0x${(1e22).toString(16)}`,
          ]);
        });
      })
    );
  });

  describe('when the election module is initialized', async () => {
    epochs.forEach((epoch) => {
      describe(`epoch ${epoch.index}`, () => {
        it(`shows that the current epoch index is ${epoch.index}`, async () => {
          assertBn.equal(await chains.mothership.GovernanceProxy.getEpochIndex(), epoch.index);
        });

        it('shows that the current period is Administration', async () => {
          assertBn.equal(
            await chains.mothership.GovernanceProxy.getCurrentPeriod(),
            ElectionPeriod.Administration
          );
        });

        describe('when trying to retrieve the current debt share of a user', () => {
          it('returns zero', async () => {
            assertBn.equal(
              await chains.mothership.GovernanceProxy.getVotePower(
                addresses[0].address,
                1115111,
                0
              ),
              0
            );
            assertBn.equal(
              await chains.mothership.GovernanceProxy.getVotePower(addresses[0].address, 10005, 0),
              0
            );
            assertBn.equal(
              await chains.mothership.GovernanceProxy.getVotePower(addresses[0].address, 43113, 0),
              0
            );
          });
        });
      });

      describe('before the nomination period begins', () => {
        describe('when trying to set the debt share id', () => {
          it('reverts', async () => {
            const { mothership, satellite1, satellite2 } = chains;
            await assertRevert(
              mothership.GovernanceProxy.takeVotePowerSnapshot(
                mothership.SnapshotRecordMock.address
              ),
              'NotCallableInCurrentPeriod'
            );
            await assertRevert(
              satellite1.GovernanceProxy.takeVotePowerSnapshot(
                satellite1.SnapshotRecordMock.address
              ),
              'NotCallableInCurrentPeriod'
            );
            await assertRevert(
              satellite1.GovernanceProxy.takeVotePowerSnapshot(
                satellite2.SnapshotRecordMock.address
              ),
              'NotCallableInCurrentPeriod'
            );
          });
        });

        describe('when trying to prepare the ballot with snapshots', () => {
          it('reverts', async () => {
            const { mothership, satellite1, satellite2 } = chains;
            await assertRevert(
              mothership.GovernanceProxy.prepareBallotWithSnapshot(
                mothership.SnapshotRecordMock.address,
                addresses[0].address
              ),
              'NotCallableInCurrentPeriod'
            );
            await assertRevert(
              satellite1.GovernanceProxy.prepareBallotWithSnapshot(
                satellite1.SnapshotRecordMock.address,
                addresses[0].address
              ),
              'NotCallableInCurrentPeriod'
            );
            await assertRevert(
              satellite2.GovernanceProxy.prepareBallotWithSnapshot(
                satellite2.SnapshotRecordMock.address,
                addresses[0].address
              ),
              'NotCallableInCurrentPeriod'
            );
          });
        });
      });

      describe('when advancing to the nominations period', () => {
        let snapshotId: ethers.BigNumber,
          snapshotId1: ethers.BigNumber,
          snapshotId2: ethers.BigNumber;
        before('fast forward to nominations', async () => {
          const { mothership, satellite1, satellite2 } = chains;
          const currentPeriod = await chains.mothership.GovernanceProxy.getCurrentPeriod();
          if (currentPeriod.eq(ethers.BigNumber.from('0'))) {
            await fastForwardToNominationPeriod(mothership.provider);
            await fastForwardToNominationPeriod(satellite1.provider);
            await fastForwardToNominationPeriod(satellite2.provider);
          }
        });

        describe('when trying to set the snapshot contract', () => {
          it('reverts', async () => {
            const { mothership, satellite1, satellite2 } = chains;
            await assertRevert(
              mothership.GovernanceProxy.setSnapshotContract(
                mothership.SnapshotRecordMock.address,
                0,
                ethers.utils.parseEther('0'),
                true
              ),
              'NotCallableInCurrentPeriod'
            );
            await assertRevert(
              satellite1.GovernanceProxy.setSnapshotContract(
                satellite1.SnapshotRecordMock.address,
                0,
                ethers.utils.parseEther('0'),
                true
              ),
              'NotCallableInCurrentPeriod'
            );
            await assertRevert(
              satellite2.GovernanceProxy.setSnapshotContract(
                satellite2.SnapshotRecordMock.address,
                0,
                ethers.utils.parseEther('0'),
                true
              ),
              'NotCallableInCurrentPeriod'
            );
          });
        });

        it('simulate debt share data', async () => {
          const { mothership, satellite1, satellite2 } = chains;

          snapshotId = await mothership.GovernanceProxy.callStatic.takeVotePowerSnapshot(
            mothership.SnapshotRecordMock.address
          );

          await mothership.GovernanceProxy.takeVotePowerSnapshot(
            mothership.SnapshotRecordMock.address
          );

          await mothership.SnapshotRecordMock.setBalanceOfOnPeriod(
            addresses[0].address,
            100,
            snapshotId.toString()
          );
          await mothership.SnapshotRecordMock.setBalanceOfOnPeriod(
            addresses[1].address,
            100,
            snapshotId.toString()
          );
          await mothership.SnapshotRecordMock.setBalanceOfOnPeriod(
            addresses[2].address,
            100,
            snapshotId.toString()
          );
          await mothership.SnapshotRecordMock.setBalanceOfOnPeriod(
            addresses[3].address,
            100,
            snapshotId.toString()
          );
          await mothership.SnapshotRecordMock.setBalanceOfOnPeriod(
            addresses[4].address,
            100,
            snapshotId.toString()
          );

          //prepare voting for satellite1
          snapshotId1 = await satellite1.GovernanceProxy.callStatic.takeVotePowerSnapshot(
            satellite1.SnapshotRecordMock.address
          );

          await satellite1.GovernanceProxy.takeVotePowerSnapshot(
            satellite1.SnapshotRecordMock.address
          );

          await satellite1.SnapshotRecordMock.setBalanceOfOnPeriod(
            addresses[0].address,
            100,
            snapshotId1.toString()
          );
          await satellite1.SnapshotRecordMock.setBalanceOfOnPeriod(
            addresses[1].address,
            100,
            snapshotId1.toString()
          );
          await satellite1.SnapshotRecordMock.setBalanceOfOnPeriod(
            addresses[2].address,
            100,
            snapshotId1.toString()
          );
          await satellite1.SnapshotRecordMock.setBalanceOfOnPeriod(
            addresses[3].address,
            100,
            snapshotId1.toString()
          );
          await satellite1.SnapshotRecordMock.setBalanceOfOnPeriod(
            addresses[4].address,
            100,
            snapshotId1.toString()
          );

          //prepare voting for satellite2
          snapshotId2 = await satellite2.GovernanceProxy.callStatic.takeVotePowerSnapshot(
            satellite2.SnapshotRecordMock.address
          );

          await satellite2.GovernanceProxy.takeVotePowerSnapshot(
            satellite2.SnapshotRecordMock.address
          );

          await satellite2.SnapshotRecordMock.setBalanceOfOnPeriod(
            addresses[0].address,
            100,
            snapshotId2.toString()
          );
          await satellite2.SnapshotRecordMock.setBalanceOfOnPeriod(
            addresses[1].address,
            100,
            snapshotId2.toString()
          );
          await satellite2.SnapshotRecordMock.setBalanceOfOnPeriod(
            addresses[2].address,
            100,
            snapshotId2.toString()
          );
          await satellite2.SnapshotRecordMock.setBalanceOfOnPeriod(
            addresses[3].address,
            100,
            snapshotId2.toString()
          );
          await satellite2.SnapshotRecordMock.setBalanceOfOnPeriod(
            addresses[4].address,
            100,
            snapshotId2.toString()
          );
        });

        it('shows that the current period is Nomination', async () => {
          assertBn.equal(
            await chains.mothership.GovernanceProxy.getCurrentPeriod(),
            ElectionPeriod.Nomination
          );
        });

        it('shows that the snapshot id is set', async () => {
          const { mothership, satellite1, satellite2 } = chains;

          const contractSnapShotIdMotherShip =
            await mothership.GovernanceProxy.getVotePowerSnapshotId(
              mothership.SnapshotRecordMock.address,
              epoch.index
            );
          const contractSnapShotIdSatellite1 =
            await satellite1.GovernanceProxy.getVotePowerSnapshotId(
              satellite1.SnapshotRecordMock.address,
              epoch.index
            );
          const contractSnapShotIdSatellite2 =
            await satellite2.GovernanceProxy.getVotePowerSnapshotId(
              satellite2.SnapshotRecordMock.address,
              epoch.index
            );

          assertBn.equal(contractSnapShotIdMotherShip, snapshotId);

          assertBn.equal(contractSnapShotIdSatellite1, snapshotId1);

          assertBn.equal(contractSnapShotIdSatellite2, snapshotId2);
        });

        describe('when cross chain debt share data is collected', () => {
          before('nominate', async () => {
            const { mothership } = chains;
            await (
              await mothership.GovernanceProxy.connect(
                addresses[1].connect(mothership.provider)
              ).nominate()
            ).wait();
            await (
              await mothership.GovernanceProxy.connect(
                addresses[3].connect(mothership.provider)
              ).nominate()
            ).wait();
            await (
              await mothership.GovernanceProxy.connect(
                addresses[4].connect(mothership.provider)
              ).nominate()
            ).wait();
            await (
              await mothership.GovernanceProxy.connect(
                addresses[5].connect(mothership.provider)
              ).nominate()
            ).wait();
            await (
              await mothership.GovernanceProxy.connect(
                addresses[6].connect(mothership.provider)
              ).nominate()
            ).wait();
            await (
              await mothership.GovernanceProxy.connect(
                addresses[7].connect(mothership.provider)
              ).nominate()
            ).wait();
            await (
              await mothership.GovernanceProxy.connect(
                addresses[8].connect(mothership.provider)
              ).nominate()
            ).wait();
          });

          it('is nominated', async () => {
            const { mothership } = chains;
            assert.equal(await mothership.GovernanceProxy.isNominated(addresses[3].address), true);
            assert.equal(await mothership.GovernanceProxy.isNominated(addresses[4].address), true);
            assert.equal(await mothership.GovernanceProxy.isNominated(addresses[5].address), true);
            assert.equal(await mothership.GovernanceProxy.isNominated(addresses[6].address), true);
            assert.equal(await mothership.GovernanceProxy.isNominated(addresses[7].address), true);
            assert.equal(await mothership.GovernanceProxy.isNominated(addresses[8].address), true);
          });

          describe('when users declare their debt shares in the wrong period', () => {
            it('reverts', async () => {
              const { mothership, satellite2 } = chains;
              await assertRevert(
                mothership.GovernanceProxy.prepareBallotWithSnapshot(
                  mothership.SnapshotRecordMock.address,
                  addresses[0].address
                ),
                'NotCallableInCurrentPeriod'
              );
              await assertRevert(
                satellite2.GovernanceProxy.prepareBallotWithSnapshot(
                  mothership.SnapshotRecordMock.address,
                  addresses[0].address
                ),
                'NotCallableInCurrentPeriod'
              );
              await assertRevert(
                satellite2.GovernanceProxy.prepareBallotWithSnapshot(
                  satellite2.SnapshotRecordMock.address,
                  addresses[0].address
                ),
                'NotCallableInCurrentPeriod'
              );
            });
          });

          describe('when advancing to the voting period', () => {
            before('fast forward to voting', async () => {
              const { mothership, satellite1, satellite2 } = chains;
              const currentPeriod = await chains.mothership.GovernanceProxy.getCurrentPeriod();
              if (currentPeriod.eq(ethers.BigNumber.from('1'))) {
                await fastForwardToVotingPeriod(mothership.provider);
                await fastForwardToVotingPeriod(satellite1.provider);
                await fastForwardToVotingPeriod(satellite2.provider);
              }
            });

            it('shows that the current period is Voting', async () => {
              assertBn.equal(
                await chains.mothership.GovernanceProxy.getCurrentPeriod(),
                ElectionPeriod.Vote
              );
            });

            describe('when users declare their cross chain debt shares incorrectly', () => {
              describe('when a user uses the wrong tree to declare', () => {
                it('reverts', async () => {
                  const { mothership, satellite1, satellite2 } = chains;
                  await assertRevert(
                    mothership.GovernanceProxy.prepareBallotWithSnapshot(
                      mothership.SnapshotRecordMock.address,
                      ethers.Wallet.createRandom().address
                    ),
                    'NoPower'
                  );
                  await assertRevert(
                    satellite1.GovernanceProxy.prepareBallotWithSnapshot(
                      satellite1.SnapshotRecordMock.address,
                      ethers.Wallet.createRandom().address
                    ),
                    'NoPower'
                  );
                  await assertRevert(
                    satellite2.GovernanceProxy.prepareBallotWithSnapshot(
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
                const { mothership, satellite1, satellite2 } = chains;
                await mothership.GovernanceProxy.prepareBallotWithSnapshot(
                  mothership.SnapshotRecordMock.address,
                  addresses[0].address
                );
                await mothership.GovernanceProxy.prepareBallotWithSnapshot(
                  mothership.SnapshotRecordMock.address,
                  addresses[1].address
                );
                // @dev: dont declare for addresses[2]

                await mothership.GovernanceProxy.prepareBallotWithSnapshot(
                  mothership.SnapshotRecordMock.address,
                  addresses[3].address
                );
                await mothership.GovernanceProxy.prepareBallotWithSnapshot(
                  mothership.SnapshotRecordMock.address,
                  addresses[4].address
                );

                await satellite1.GovernanceProxy.prepareBallotWithSnapshot(
                  satellite1.SnapshotRecordMock.address,
                  addresses[0].address
                );

                await satellite1.GovernanceProxy.prepareBallotWithSnapshot(
                  satellite1.SnapshotRecordMock.address,
                  addresses[1].address
                );

                // @dev: dont declare for addresses[2]

                await satellite1.GovernanceProxy.prepareBallotWithSnapshot(
                  satellite1.SnapshotRecordMock.address,
                  addresses[3].address
                );

                await satellite1.GovernanceProxy.prepareBallotWithSnapshot(
                  satellite1.SnapshotRecordMock.address,
                  addresses[4].address
                );

                await satellite2.GovernanceProxy.prepareBallotWithSnapshot(
                  satellite2.SnapshotRecordMock.address,
                  addresses[0].address
                );
                await satellite2.GovernanceProxy.prepareBallotWithSnapshot(
                  satellite2.SnapshotRecordMock.address,
                  addresses[1].address
                );

                // @dev: dont declare for addresses[2]

                await satellite2.GovernanceProxy.prepareBallotWithSnapshot(
                  satellite2.SnapshotRecordMock.address,
                  addresses[3].address
                );

                await satellite2.GovernanceProxy.prepareBallotWithSnapshot(
                  satellite2.SnapshotRecordMock.address,
                  addresses[4].address
                );
              });

              describe('when a user attempts to re-declare debt shares', () => {
                it('reverts', async () => {
                  const { mothership, satellite1, satellite2 } = chains;
                  await assertRevert(
                    mothership.GovernanceProxy.prepareBallotWithSnapshot(
                      mothership.SnapshotRecordMock.address,
                      addresses[0].address
                    ),
                    'BallotAlreadyPrepared'
                  );
                  await assertRevert(
                    satellite1.GovernanceProxy.prepareBallotWithSnapshot(
                      satellite1.SnapshotRecordMock.address,
                      addresses[0].address
                    ),
                    'BallotAlreadyPrepared'
                  );
                  await assertRevert(
                    satellite2.GovernanceProxy.prepareBallotWithSnapshot(
                      satellite2.SnapshotRecordMock.address,
                      addresses[0].address
                    ),
                    'BallotAlreadyPrepared'
                  );
                });
              });

              describe('when users cast votes', () => {
                before('vote', async () => {
                  const { mothership } = chains;

                  await mothership.GovernanceProxy.connect(
                    addresses[0].connect(mothership.provider)
                  ).cast([epoch.winners()[0]], [10]);

                  await mothership.GovernanceProxy.connect(
                    addresses[1].connect(mothership.provider)
                  ).cast([epoch.winners()[0]], [10]);

                  // addresses[2] didn't declare cross chain debt shares yet
                  await assertRevert(
                    mothership.GovernanceProxy.connect(
                      addresses[2].connect(mothership.provider)
                    ).cast([addresses[4].address], [10]),
                    'NoVotingPower',
                    mothership.GovernanceProxy
                  );

                  await mothership.GovernanceProxy.connect(
                    addresses[3].connect(mothership.provider)
                  ).cast([addresses[1].address], [10]);

                  await mothership.GovernanceProxy.connect(
                    addresses[4].connect(mothership.provider)
                  ).cast([epoch.winners()[0]], [10]);
                });

                it('do not allow partial voting', async () => {
                  const { mothership } = chains;
                  await assertRevert(
                    mothership.GovernanceProxy.connect(
                      addresses[0].connect(mothership.provider)
                    ).cast([addresses[3].address], [13]),
                    'InvalidBallot',
                    mothership.GovernanceProxy
                  );
                });

                it('keeps track of which ballot each user voted on', async () => {
                  const { mothership } = chains;

                  const ballotForFirstAddress = await mothership.GovernanceProxy.getBallot(
                    addresses[0].address,
                    (await mothership.provider.getNetwork()).chainId,
                    epoch.index
                  );

                  const ballotForSecondAddress = await mothership.GovernanceProxy.getBallot(
                    addresses[1].address,
                    (await mothership.provider.getNetwork()).chainId,
                    epoch.index
                  );

                  const ballotForThirdAddress = await mothership.GovernanceProxy.getBallot(
                    addresses[2].address,
                    (await mothership.provider.getNetwork()).chainId,
                    epoch.index
                  );

                  const ballotForFourthAddress = await mothership.GovernanceProxy.getBallot(
                    addresses[3].address,
                    (await mothership.provider.getNetwork()).chainId,
                    epoch.index
                  );

                  const ballotForFifthAddress = await mothership.GovernanceProxy.getBallot(
                    addresses[4].address,
                    (await mothership.provider.getNetwork()).chainId,
                    epoch.index
                  );

                  assert.deepEqual(
                    [
                      ballotForFirstAddress.amounts,
                      ballotForFirstAddress.votedCandidates,
                      ballotForFirstAddress.votingPower,
                    ],
                    [[ethers.BigNumber.from(10)], [epoch.winners()[0]], ethers.BigNumber.from(10)]
                  );

                  assert.deepEqual(
                    [
                      ballotForSecondAddress.amounts,
                      ballotForSecondAddress.votedCandidates,
                      ballotForSecondAddress.votingPower,
                    ],
                    [[ethers.BigNumber.from(10)], [epoch.winners()[0]], ethers.BigNumber.from(10)]
                  );

                  //  should be empty
                  assert.deepEqual(
                    [
                      ballotForThirdAddress.amounts,
                      ballotForThirdAddress.votedCandidates,
                      ballotForThirdAddress.votingPower,
                    ],
                    [[], [], ethers.BigNumber.from(0)]
                  );

                  assert.deepEqual(
                    [
                      ballotForFourthAddress.amounts,
                      ballotForFourthAddress.votedCandidates,
                      ballotForFourthAddress.votingPower,
                    ],
                    [[ethers.BigNumber.from(10)], [addresses[1].address], ethers.BigNumber.from(10)]
                  );

                  assert.deepEqual(
                    [
                      ballotForFifthAddress.amounts,
                      ballotForFifthAddress.votedCandidates,
                      ballotForFifthAddress.votingPower,
                    ],
                    [[ethers.BigNumber.from(10)], [epoch.winners()[0]], ethers.BigNumber.from(10)]
                  );
                });

                it('keeps track of the candidates of each ballot', async () => {
                  const { mothership } = chains;
                  assert.deepEqual(
                    await mothership.GovernanceProxy.getBallotCandidates(
                      addresses[0].address,
                      11155111,
                      epoch.index
                    ),
                    [epoch.winners()[0]]
                  );
                  assert.deepEqual(
                    await mothership.GovernanceProxy.getBallotCandidates(
                      addresses[1].address,
                      11155111,
                      epoch.index
                    ),
                    [epoch.winners()[0]]
                  );
                  assert.deepEqual(
                    await mothership.GovernanceProxy.getBallotCandidates(
                      addresses[2].address,
                      11155111,
                      epoch.index
                    ),
                    []
                  );
                  assert.deepEqual(
                    await mothership.GovernanceProxy.getBallotCandidates(
                      addresses[3].address,
                      11155111,
                      epoch.index
                    ),
                    [addresses[1].address]
                  );
                  assert.deepEqual(
                    await mothership.GovernanceProxy.getBallotCandidates(
                      addresses[4].address,
                      11155111,
                      epoch.index
                    ),
                    [epoch.winners()[0]]
                  );
                });

                describe('when voting ends', () => {
                  before('fast forward to evaluation', async () => {
                    const { mothership, satellite1, satellite2 } = chains;
                    const currentPeriod =
                      await chains.mothership.GovernanceProxy.getCurrentPeriod();
                    if (currentPeriod.eq(ethers.BigNumber.from('2'))) {
                      await fastForwardToEvaluationPeriod(mothership.provider);
                      await fastForwardToEvaluationPeriod(satellite1.provider);
                      await fastForwardToEvaluationPeriod(satellite2.provider);
                    }
                  });

                  it('shows that the current period is Evaluation', async () => {
                    const { mothership } = chains;
                    assertBn.equal(
                      await mothership.GovernanceProxy.getCurrentPeriod(),
                      ElectionPeriod.Evaluation
                    );
                  });

                  describe('when the election is evaluated', () => {
                    let rx: ethers.ContractReceipt;

                    before('evaluate', async () => {
                      rx = await (await chains.mothership.GovernanceProxy.evaluate(0)).wait();
                    });

                    it('emits the event ElectionEvaluated', async () => {
                      await assertEvent(
                        rx,
                        `ElectionEvaluated(${epoch.index}, 4)`,
                        chains.mothership.GovernanceProxy
                      );
                    });

                    it('shows that the election is evaluated', async () => {
                      assert.equal(
                        await chains.mothership.GovernanceProxy.isElectionEvaluated(),
                        true
                      );
                    });

                    it('shows the election winners', async () => {
                      const { mothership } = chains;
                      assert.deepEqual(
                        await mothership.GovernanceProxy.getElectionWinners(),
                        epoch.winners()
                      );
                    });

                    describe('when the election is resolved', () => {
                      before('resolve', async () => {
                        const { mothership } = chains;

                        await mothership.WormholeRelayerMock.setCost(ethers.utils.parseEther('1'));

                        const balanceBefore = await chains.mothership.signer.getBalance();

                        const quote1 =
                          await chains.mothership.WormholeRelayerMock.quoteEVMDeliveryPrice(
                            WormholeChainSelector.satellite1,
                            0,
                            100000
                          );
                        const quote2 =
                          await chains.mothership.WormholeRelayerMock.quoteEVMDeliveryPrice(
                            WormholeChainSelector.satellite2,
                            0,
                            100000
                          );

                        const quoteSum = quote1.nativePriceQuote.add(quote2.nativePriceQuote);

                        // we send the quote (for both chains), plus one extra ether. the extra ether should be refunded
                        const value = quoteSum.add(ethers.utils.parseEther('1'));

                        const rx = await (
                          await mothership.GovernanceProxy.resolve({
                            value: value.toString(),
                          })
                        ).wait();

                        await deliverResolve(rx);

                        const balanceAfter = await chains.mothership.signer.getBalance();
                        const gasUsed = rx.gasUsed.mul(rx.effectiveGasPrice);

                        // balance should be 2 ether less, minus the gas used. The extra eth sent should be refunded
                        assertBn.near(balanceBefore.sub(balanceAfter).sub(gasUsed), quoteSum);
                      });

                      it('shows the expected NFT owners', async () => {
                        const { mothership } = chains;

                        assertBn.equal(
                          await mothership.CouncilToken.balanceOf(epoch.winners()[0]),
                          1
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
