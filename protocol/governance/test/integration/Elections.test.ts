import assert from 'node:assert/strict';
import { ccipReceive } from '@synthetixio/core-modules/test/helpers/ccip';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { ethers } from 'ethers';
import { ElectionPeriod } from '../constants';
import { ChainSelector, integrationBootstrap } from './bootstrap';

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
    const schedule = await chains.mothership.CoreProxy.getEpochSchedule();
    await fastForwardTo(schedule.nominationPeriodStartDate.toNumber() + 10, provider);
  };

  const fastForwardToVotingPeriod = async (provider: ethers.providers.JsonRpcProvider) => {
    const schedule = await chains.mothership.CoreProxy.getEpochSchedule();
    await fastForwardTo(schedule.votingPeriodStartDate.toNumber() + 10, provider);
  };

  const fastForwardToEvaluationPeriod = async (provider: ethers.providers.JsonRpcProvider) => {
    const schedule = await chains.mothership.CoreProxy.getEpochSchedule();
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

  before('set snapshot contract', async () => {
    const { mothership, satellite1, satellite2 } = chains;
    await mothership.CoreProxy.setSnapshotContract(mothership.SnapshotRecordMock.address, true);
    await satellite1.CoreProxy.setSnapshotContract(satellite1.SnapshotRecordMock.address, true);
    await satellite2.CoreProxy.setSnapshotContract(satellite2.SnapshotRecordMock.address, true);
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
          assertBn.equal(await chains.mothership.CoreProxy.getEpochIndex(), epoch.index);
        });

        it('shows that the current period is Administration', async () => {
          assertBn.equal(
            await chains.mothership.CoreProxy.getCurrentPeriod(),
            ElectionPeriod.Administration
          );
        });

        describe('when trying to retrieve the current debt share of a user', () => {
          it('returns zero', async () => {
            assertBn.equal(
              await chains.mothership.CoreProxy.getVotePower(addresses[0].address, 1115111, 0),
              0
            );
            assertBn.equal(
              await chains.mothership.CoreProxy.getVotePower(addresses[0].address, 420, 0),
              0
            );
            assertBn.equal(
              await chains.mothership.CoreProxy.getVotePower(addresses[0].address, 43113, 0),
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
            const { mothership, satellite1, satellite2 } = chains;
            await assertRevert(
              mothership.CoreProxy.prepareBallotWithSnapshot(
                mothership.SnapshotRecordMock.address,
                addresses[0].address
              ),
              'NotCallableInCurrentPeriod'
            );
            await assertRevert(
              satellite1.CoreProxy.prepareBallotWithSnapshot(
                satellite1.SnapshotRecordMock.address,
                addresses[0].address
              ),
              'NotCallableInCurrentPeriod'
            );
            await assertRevert(
              satellite2.CoreProxy.prepareBallotWithSnapshot(
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
        it('fast forward', async () => {
          const { mothership, satellite1, satellite2 } = chains;
          await fastForwardToNominationPeriod(mothership.provider);
          await fastForwardToNominationPeriod(satellite1.provider);
          await fastForwardToNominationPeriod(satellite2.provider);
        });

        describe('when trying to set the snapshot contract', () => {
          it('reverts', async () => {
            const { mothership, satellite1, satellite2 } = chains;
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

        it('simulate debt share data', async () => {
          const { mothership, satellite1, satellite2 } = chains;

          snapshotId = await mothership.CoreProxy.callStatic.takeVotePowerSnapshot(
            mothership.SnapshotRecordMock.address
          );

          await mothership.CoreProxy.takeVotePowerSnapshot(mothership.SnapshotRecordMock.address);

          await mothership.SnapshotRecordMock.setBalanceOfOnPeriod(
            addresses[0].address,
            ethers.utils.parseEther('100'),
            snapshotId.toString()
          );
          await mothership.SnapshotRecordMock.setBalanceOfOnPeriod(
            addresses[1].address,
            ethers.utils.parseEther('100'),
            snapshotId.toString()
          );
          await mothership.SnapshotRecordMock.setBalanceOfOnPeriod(
            addresses[2].address,
            ethers.utils.parseEther('100'),
            snapshotId.toString()
          );
          await mothership.SnapshotRecordMock.setBalanceOfOnPeriod(
            addresses[3].address,
            ethers.utils.parseEther('100'),
            snapshotId.toString()
          );
          await mothership.SnapshotRecordMock.setBalanceOfOnPeriod(
            addresses[4].address,
            ethers.utils.parseEther('100'),
            snapshotId.toString()
          );

          //prepare voting for satellite1
          snapshotId1 = await satellite1.CoreProxy.callStatic.takeVotePowerSnapshot(
            satellite1.SnapshotRecordMock.address
          );

          await satellite1.CoreProxy.takeVotePowerSnapshot(satellite1.SnapshotRecordMock.address);

          await satellite1.SnapshotRecordMock.setBalanceOfOnPeriod(
            addresses[0].address,
            ethers.utils.parseEther('100'),
            snapshotId1.toString()
          );
          await satellite1.SnapshotRecordMock.setBalanceOfOnPeriod(
            addresses[1].address,
            ethers.utils.parseEther('100'),
            snapshotId1.toString()
          );
          await satellite1.SnapshotRecordMock.setBalanceOfOnPeriod(
            addresses[2].address,
            ethers.utils.parseEther('100'),
            snapshotId1.toString()
          );
          await satellite1.SnapshotRecordMock.setBalanceOfOnPeriod(
            addresses[3].address,
            ethers.utils.parseEther('100'),
            snapshotId1.toString()
          );
          await satellite1.SnapshotRecordMock.setBalanceOfOnPeriod(
            addresses[4].address,
            ethers.utils.parseEther('100'),
            snapshotId1.toString()
          );

          //prepare voting for satellite2
          snapshotId2 = await satellite2.CoreProxy.callStatic.takeVotePowerSnapshot(
            satellite2.SnapshotRecordMock.address
          );

          await satellite2.CoreProxy.takeVotePowerSnapshot(satellite2.SnapshotRecordMock.address);

          await satellite2.SnapshotRecordMock.setBalanceOfOnPeriod(
            addresses[0].address,
            ethers.utils.parseEther('100'),
            snapshotId2.toString()
          );
          await satellite2.SnapshotRecordMock.setBalanceOfOnPeriod(
            addresses[1].address,
            ethers.utils.parseEther('100'),
            snapshotId2.toString()
          );
          await satellite2.SnapshotRecordMock.setBalanceOfOnPeriod(
            addresses[2].address,
            ethers.utils.parseEther('100'),
            snapshotId2.toString()
          );
          await satellite2.SnapshotRecordMock.setBalanceOfOnPeriod(
            addresses[3].address,
            ethers.utils.parseEther('100'),
            snapshotId2.toString()
          );
          await satellite2.SnapshotRecordMock.setBalanceOfOnPeriod(
            addresses[4].address,
            ethers.utils.parseEther('100'),
            snapshotId2.toString()
          );
        });

        it('shows that the current period is Nomination', async () => {
          assertBn.equal(
            await chains.mothership.CoreProxy.getCurrentPeriod(),
            ElectionPeriod.Nomination
          );
        });

        it('shows that the snapshot id is set', async () => {
          const { mothership, satellite1, satellite2 } = chains;

          const contractSnapShotIdMotherShip = await mothership.CoreProxy.getVotePowerSnapshotId(
            mothership.SnapshotRecordMock.address,
            epoch.index
          );
          const contractSnapShotIdSatellite1 = await satellite1.CoreProxy.getVotePowerSnapshotId(
            satellite1.SnapshotRecordMock.address,
            epoch.index
          );
          const contractSnapShotIdSatellite2 = await satellite2.CoreProxy.getVotePowerSnapshotId(
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
              await mothership.CoreProxy.connect(
                addresses[1].connect(mothership.provider)
              ).nominate()
            ).wait();
            await (
              await mothership.CoreProxy.connect(
                addresses[3].connect(mothership.provider)
              ).nominate()
            ).wait();
            await (
              await mothership.CoreProxy.connect(
                addresses[4].connect(mothership.provider)
              ).nominate()
            ).wait();
            await (
              await mothership.CoreProxy.connect(
                addresses[5].connect(mothership.provider)
              ).nominate()
            ).wait();
            await (
              await mothership.CoreProxy.connect(
                addresses[6].connect(mothership.provider)
              ).nominate()
            ).wait();
            await (
              await mothership.CoreProxy.connect(
                addresses[7].connect(mothership.provider)
              ).nominate()
            ).wait();
            await (
              await mothership.CoreProxy.connect(
                addresses[8].connect(mothership.provider)
              ).nominate()
            ).wait();
          });

          it('is nominated', async () => {
            const { mothership } = chains;
            assert.equal(await mothership.CoreProxy.isNominated(addresses[3].address), true);
            assert.equal(await mothership.CoreProxy.isNominated(addresses[4].address), true);
            assert.equal(await mothership.CoreProxy.isNominated(addresses[5].address), true);
            assert.equal(await mothership.CoreProxy.isNominated(addresses[6].address), true);
            assert.equal(await mothership.CoreProxy.isNominated(addresses[7].address), true);
            assert.equal(await mothership.CoreProxy.isNominated(addresses[8].address), true);
          });

          describe('when users declare their debt shares in the wrong period', () => {
            it('reverts', async () => {
              const { mothership, satellite2 } = chains;
              await assertRevert(
                mothership.CoreProxy.prepareBallotWithSnapshot(
                  mothership.SnapshotRecordMock.address,
                  addresses[0].address
                ),
                'NotCallableInCurrentPeriod'
              );
              await assertRevert(
                satellite2.CoreProxy.prepareBallotWithSnapshot(
                  mothership.SnapshotRecordMock.address,
                  addresses[0].address
                ),
                'NotCallableInCurrentPeriod'
              );
              await assertRevert(
                satellite2.CoreProxy.prepareBallotWithSnapshot(
                  satellite2.SnapshotRecordMock.address,
                  addresses[0].address
                ),
                'NotCallableInCurrentPeriod'
              );
            });
          });

          describe('when advancing to the voting period', () => {
            before('fast forward', async () => {
              const { mothership, satellite1, satellite2 } = chains;
              await fastForwardToVotingPeriod(mothership.provider);
              await fastForwardToVotingPeriod(satellite1.provider);
              await fastForwardToVotingPeriod(satellite2.provider);
            });

            it('shows that the current period is Voting', async () => {
              assertBn.equal(
                await chains.mothership.CoreProxy.getCurrentPeriod(),
                ElectionPeriod.Vote
              );
            });

            describe('when users declare their cross chain debt shares incorrectly', () => {
              describe('when a user uses the wrong tree to declare', () => {
                it('reverts', async () => {
                  const { mothership, satellite1, satellite2 } = chains;
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
                const { mothership, satellite1, satellite2 } = chains;
                await mothership.CoreProxy.prepareBallotWithSnapshot(
                  mothership.SnapshotRecordMock.address,
                  addresses[0].address
                );
                await mothership.CoreProxy.prepareBallotWithSnapshot(
                  mothership.SnapshotRecordMock.address,
                  addresses[1].address
                );
                // @dev: dont declare for addresses[2]

                await mothership.CoreProxy.prepareBallotWithSnapshot(
                  mothership.SnapshotRecordMock.address,
                  addresses[3].address
                );
                await mothership.CoreProxy.prepareBallotWithSnapshot(
                  mothership.SnapshotRecordMock.address,
                  addresses[4].address
                );

                await satellite1.CoreProxy.prepareBallotWithSnapshot(
                  satellite1.SnapshotRecordMock.address,
                  addresses[0].address
                );

                await satellite1.CoreProxy.prepareBallotWithSnapshot(
                  satellite1.SnapshotRecordMock.address,
                  addresses[1].address
                );

                // @dev: dont declare for addresses[2]

                await satellite1.CoreProxy.prepareBallotWithSnapshot(
                  satellite1.SnapshotRecordMock.address,
                  addresses[3].address
                );

                await satellite1.CoreProxy.prepareBallotWithSnapshot(
                  satellite1.SnapshotRecordMock.address,
                  addresses[4].address
                );

                await satellite2.CoreProxy.prepareBallotWithSnapshot(
                  satellite2.SnapshotRecordMock.address,
                  addresses[0].address
                );
                await satellite2.CoreProxy.prepareBallotWithSnapshot(
                  satellite2.SnapshotRecordMock.address,
                  addresses[1].address
                );

                // @dev: dont declare for addresses[2]

                await satellite2.CoreProxy.prepareBallotWithSnapshot(
                  satellite2.SnapshotRecordMock.address,
                  addresses[3].address
                );

                await satellite2.CoreProxy.prepareBallotWithSnapshot(
                  satellite2.SnapshotRecordMock.address,
                  addresses[4].address
                );
              });

              describe('when a user attempts to re-declare debt shares', () => {
                it('reverts', async () => {
                  const { mothership, satellite1, satellite2 } = chains;
                  await assertRevert(
                    mothership.CoreProxy.prepareBallotWithSnapshot(
                      mothership.SnapshotRecordMock.address,
                      addresses[0].address
                    ),
                    'BallotAlreadyPrepared'
                  );
                  await assertRevert(
                    satellite1.CoreProxy.prepareBallotWithSnapshot(
                      satellite1.SnapshotRecordMock.address,
                      addresses[0].address
                    ),
                    'BallotAlreadyPrepared'
                  );
                  await assertRevert(
                    satellite2.CoreProxy.prepareBallotWithSnapshot(
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

                  await mothership.CoreProxy.connect(
                    addresses[0].connect(mothership.provider)
                  ).cast([epoch.winners()[0]], [ethers.utils.parseEther('100')]);

                  await mothership.CoreProxy.connect(
                    addresses[1].connect(mothership.provider)
                  ).cast([epoch.winners()[0]], [ethers.utils.parseEther('100')]);

                  // addresses[2] didn't declare cross chain debt shares yet
                  await assertRevert(
                    mothership.CoreProxy.connect(addresses[2].connect(mothership.provider)).cast(
                      [addresses[4].address],
                      [ethers.utils.parseEther('100')]
                    ),
                    'NoVotingPower',
                    mothership.CoreProxy
                  );

                  await mothership.CoreProxy.connect(
                    addresses[3].connect(mothership.provider)
                  ).cast([addresses[1].address], [ethers.utils.parseEther('100')]);

                  await mothership.CoreProxy.connect(
                    addresses[4].connect(mothership.provider)
                  ).cast([epoch.winners()[0]], [ethers.utils.parseEther('100')]);
                });

                it('do not allow partial voting', async () => {
                  const { mothership } = chains;
                  await assertRevert(
                    mothership.CoreProxy.connect(addresses[0].connect(mothership.provider)).cast(
                      [addresses[3].address],
                      [ethers.utils.parseEther('10')]
                    ),
                    'InvalidBallot',
                    mothership.CoreProxy
                  );
                });

                it('keeps track of which ballot each user voted on', async () => {
                  const { mothership } = chains;

                  const ballotForFirstAddress = await mothership.CoreProxy.getBallot(
                    addresses[0].address,
                    (await mothership.provider.getNetwork()).chainId,
                    epoch.index
                  );

                  const ballotForSecondAddress = await mothership.CoreProxy.getBallot(
                    addresses[1].address,
                    (await mothership.provider.getNetwork()).chainId,
                    epoch.index
                  );

                  const ballotForThirdAddress = await mothership.CoreProxy.getBallot(
                    addresses[2].address,
                    (await mothership.provider.getNetwork()).chainId,
                    epoch.index
                  );

                  const ballotForFourthAddress = await mothership.CoreProxy.getBallot(
                    addresses[3].address,
                    (await mothership.provider.getNetwork()).chainId,
                    epoch.index
                  );

                  const ballotForFifthAddress = await mothership.CoreProxy.getBallot(
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
                    [
                      [ethers.utils.parseEther('100')],
                      [epoch.winners()[0]],
                      ethers.utils.parseEther('100'),
                    ]
                  );

                  assert.deepEqual(
                    [
                      ballotForSecondAddress.amounts,
                      ballotForSecondAddress.votedCandidates,
                      ballotForSecondAddress.votingPower,
                    ],
                    [
                      [ethers.utils.parseEther('100')],
                      [epoch.winners()[0]],
                      ethers.utils.parseEther('100'),
                    ]
                  );

                  //  should be empty
                  assert.deepEqual(
                    [
                      ballotForThirdAddress.amounts,
                      ballotForThirdAddress.votedCandidates,
                      ballotForThirdAddress.votingPower,
                    ],
                    [[], [], ethers.utils.parseEther('0')]
                  );

                  assert.deepEqual(
                    [
                      ballotForFourthAddress.amounts,
                      ballotForFourthAddress.votedCandidates,
                      ballotForFourthAddress.votingPower,
                    ],
                    [
                      [ethers.utils.parseEther('100')],
                      [addresses[1].address],
                      ethers.utils.parseEther('100'),
                    ]
                  );

                  assert.deepEqual(
                    [
                      ballotForFifthAddress.amounts,
                      ballotForFifthAddress.votedCandidates,
                      ballotForFifthAddress.votingPower,
                    ],
                    [
                      [ethers.utils.parseEther('100')],
                      [epoch.winners()[0]],
                      ethers.utils.parseEther('100'),
                    ]
                  );
                });

                it('keeps track of the candidates of each ballot', async () => {
                  const { mothership } = chains;
                  assert.deepEqual(
                    await mothership.CoreProxy.getBallotCandidates(
                      addresses[0].address,
                      11155111,
                      epoch.index
                    ),
                    [epoch.winners()[0]]
                  );
                  assert.deepEqual(
                    await mothership.CoreProxy.getBallotCandidates(
                      addresses[1].address,
                      11155111,
                      epoch.index
                    ),
                    [epoch.winners()[0]]
                  );
                  assert.deepEqual(
                    await mothership.CoreProxy.getBallotCandidates(
                      addresses[2].address,
                      11155111,
                      epoch.index
                    ),
                    []
                  );
                  assert.deepEqual(
                    await mothership.CoreProxy.getBallotCandidates(
                      addresses[3].address,
                      11155111,
                      epoch.index
                    ),
                    [addresses[1].address]
                  );
                  assert.deepEqual(
                    await mothership.CoreProxy.getBallotCandidates(
                      addresses[4].address,
                      11155111,
                      epoch.index
                    ),
                    [epoch.winners()[0]]
                  );
                });

                describe('when voting ends', () => {
                  before('fast forward', async () => {
                    const { mothership, satellite1, satellite2 } = chains;
                    await fastForwardToEvaluationPeriod(mothership.provider);
                    await fastForwardToEvaluationPeriod(satellite1.provider);
                    await fastForwardToEvaluationPeriod(satellite2.provider);
                  });

                  it('shows that the current period is Evaluation', async () => {
                    const { mothership } = chains;
                    assertBn.equal(
                      await mothership.CoreProxy.getCurrentPeriod(),
                      ElectionPeriod.Evaluation
                    );
                  });

                  describe('when the election is evaluated', () => {
                    let rx: ethers.ContractReceipt;

                    before('evaluate', async () => {
                      rx = await (await chains.mothership.CoreProxy.evaluate(0)).wait();
                    });

                    it('emits the event ElectionEvaluated', async () => {
                      await assertEvent(
                        rx,
                        `ElectionEvaluated(${epoch.index}, 4)`,
                        chains.mothership.CoreProxy
                      );
                    });

                    it('shows that the election is evaluated', async () => {
                      assert.equal(await chains.mothership.CoreProxy.isElectionEvaluated(), true);
                    });

                    it('shows the election winners', async () => {
                      const { mothership } = chains;
                      assert.deepEqual(
                        await mothership.CoreProxy.getElectionWinners(),
                        epoch.winners()
                      );
                    });

                    describe('when the election is resolved', () => {
                      before('resolve', async () => {
                        const { mothership, satellite1, satellite2 } = chains;
                        const rx = await (
                          await mothership.CoreProxy.resolve({
                            value: ethers.utils.parseEther('1'),
                          })
                        ).wait();

                        await ccipReceive({
                          rx,
                          ccipAddress: satellite1.CcipRouter.address,
                          sourceChainSelector: ChainSelector.mothership,
                          targetSigner: satellite1.signer,
                          index: 0,
                        });

                        await ccipReceive({
                          rx,
                          ccipAddress: satellite2.CcipRouter.address,
                          sourceChainSelector: ChainSelector.mothership,
                          targetSigner: satellite2.signer,
                          index: 1,
                        });
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
