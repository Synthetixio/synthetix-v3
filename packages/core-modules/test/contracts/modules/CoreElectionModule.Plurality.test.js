const { deepEqual, equal } = require('assert/strict');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');
const { fastForward } = require('@synthetixio/core-js/utils/hardhat/rpc');
const assertBignumber = require('@synthetixio/core-js/utils/assertions/assert-bignumber');

const { ethers } = hre;

describe('CoreElectionModule Count Votes using Simple Plurality strategy', () => {
  const { proxyAddress } = bootstrap(initializer);

  let CoreElectionModule, ElectionStorageMock, ElectionToken;
  let owner;

  const minute = 60 * 1000;
  const day = 24 * 60 * minute;
  const week = 7 * day;

  before('identify signers, candidates and voters', async () => {
    [owner] = await ethers.getSigners();
  });

  before('identify modules', async () => {
    CoreElectionModule = await ethers.getContractAt('CoreElectionModule', proxyAddress());
    ElectionStorageMock = await ethers.getContractAt('ElectionStorageMock', proxyAddress());
  });

  before('setup tokens', async () => {
    const factory = await ethers.getContractFactory('ElectionTokenMock');
    ElectionToken = await factory.deploy();

    await (
      await CoreElectionModule.connect(owner).setElectionTokenAddress(ElectionToken.address)
    ).wait();

    await (await CoreElectionModule.createMemberToken('Member Token', 'cmt')).wait();
  });

  it('setup is done', async () => {
    equal(await CoreElectionModule.isEpochFinished(), false, 'wrong epoch finished state');
  });

  describe('when counting votes', async () => {
    describe('when counting a small number of votes', async () => {
      let candidates, voters;

      before('identify candidates and voters', async () => {
        candidates = (await ethers.getSigners())
          .slice(2, 7)
          .sort((a, b) => Number(a.address) - Number(b.address));
        voters = (await ethers.getSigners()).slice(2, 7);
      });

      before('set epoch', async () => {
        await (await CoreElectionModule.connect(owner).setNextEpochDuration(week)).wait();
        await (await CoreElectionModule.connect(owner).setNextPeriodPercent(15)).wait();
        await (await CoreElectionModule.connect(owner).setNextSeatCount(3)).wait();
        await (await ElectionStorageMock.initNextEpochMock()).wait();
      });

      before('nominate and setup voters', async () => {
        await Promise.all(
          candidates.map((candidate) => CoreElectionModule.connect(candidate).nominate())
        );

        for (let i = 0; i < voters.length; i++) {
          await ElectionToken.connect(voters[i]).mint(100 + i * 10);
        }
      });

      after('cleanup voters', async () => {
        for (const voter of voters) {
          await ElectionToken.connect(voter).burn(await ElectionToken.balanceOf(voter.address));
        }
      });

      before('fastForward to voting phase', async () => {
        await fastForward(3 * day, ethers.provider);
      });

      it('is voting phase', async () => {
        equal(await CoreElectionModule.isVoting(), true, 'wrong voting phase');
        assertBignumber.eq(await CoreElectionModule.getPeriodPercent(), 15);
        assertBignumber.eq(await CoreElectionModule.getSeatCount(), 3);
      });

      describe('when attempting to evaluate the election before time', () => {
        it('reverts', async () => {
          await assertRevert(CoreElectionModule.evaluateElectionBatch(), 'EpochNotFinished');
        });
      });

      describe('when casting votes', () => {
        before('cast votes', async () => {
          for (let i = 1; i < voters.length; i++) {
            let candidateIdx = i % candidates.length;

            if (candidateIdx == 0) {
              await CoreElectionModule.connect(voters[i]).elect([candidates[0].address]);
              continue;
            }

            await CoreElectionModule.connect(voters[i]).elect([
              candidates[0].address,
              candidates[candidateIdx].address,
            ]);
          }
        });

        before('fastForward to close voting phase', async () => {
          await fastForward(week, ethers.provider);
        });

        before('set the batch size to fit all candidates', async () => {
          await (await CoreElectionModule.connect(owner).setMaxProcessingBatchSize(10)).wait();
        });

        it('the election is not evaluated', async () => {
          equal(await CoreElectionModule.isElectionEvaluated(), false);
        });

        describe('when evaluating the election', () => {
          let nextEpochMembers, nextEpochMemberVotes;

          before('evaluate the election', async () => {
            await (await CoreElectionModule.evaluateElectionBatch()).wait();
            nextEpochMembers = await ElectionStorageMock.getNextEpochMembers();
            nextEpochMemberVotes = await ElectionStorageMock.getNextEpochMemberVotes();
          });

          it('the election is evaluated', async () => {
            equal(await CoreElectionModule.isElectionEvaluated(), true);
          });

          it('the votes are counted correctly', async () => {
            let nextEpochMemberVotesParsed = nextEpochMemberVotes.map((votes) => votes.toString());

            equal(nextEpochMembers.length, 3);
            deepEqual(nextEpochMembers, [
              candidates[0].address,
              candidates[3].address,
              candidates[4].address,
            ]);
            deepEqual(nextEpochMemberVotesParsed, ['500', '130', '140']);
          });
        });

        describe('when attempting to evaluate the election again', () => {
          it('reverts', async () => {
            await assertRevert(
              CoreElectionModule.evaluateElectionBatch(),
              'ElectionAlreadyEvaluated'
            );
          });
        });
      });
    });

    describe('when counting a large number of votes and candidates', async () => {
      let candidates, voters;

      before('identify candidates and voters', async () => {
        candidates = (await ethers.getSigners())
          .slice(2, 12)
          .sort((a, b) => Number(a.address) - Number(b.address));
        voters = (await ethers.getSigners()).slice(2, 12);
      });

      before('set epoch', async () => {
        await (await ElectionStorageMock.initNextEpochMock()).wait();
      });

      before('nominate and setup voters', async () => {
        await Promise.all(
          candidates.map((candidate) => CoreElectionModule.connect(candidate).nominate())
        );

        for (let i = 0; i < voters.length; i++) {
          await ElectionToken.connect(voters[i]).mint(100 + i * 10);
        }
      });

      after('cleanup voters', async () => {
        for (const voter of voters) {
          await ElectionToken.connect(voter).burn(await ElectionToken.balanceOf(voter.address));
        }
      });

      before('fastForward to voting phase', async () => {
        await fastForward(3 * day, ethers.provider);
      });

      it('is voting phase', async () => {
        equal(await CoreElectionModule.isVoting(), true, 'wrong voting phase');
        assertBignumber.eq(await CoreElectionModule.getPeriodPercent(), 15);
        assertBignumber.eq(await CoreElectionModule.getSeatCount(), 3);
      });

      describe('when casting votes', () => {
        before('cast votes', async () => {
          for (let i = 1; i < voters.length; i++) {
            let candidateIdx = i % candidates.length;

            if (candidateIdx == 0) {
              await CoreElectionModule.connect(voters[i]).elect([candidates[0].address]);
              continue;
            }

            await CoreElectionModule.connect(voters[i]).elect([
              candidates[0].address,
              candidates[candidateIdx].address,
            ]);
          }
        });

        before('fastForward to close voting phase', async () => {
          await fastForward(week, ethers.provider);
        });

        before('set the batch size to NOT fit all candidates', async () => {
          await (await CoreElectionModule.connect(owner).setMaxProcessingBatchSize(5)).wait();
        });

        it('the election is not evaluated', async () => {
          equal(await CoreElectionModule.isElectionEvaluated(), false);
        });

        describe('when evaluating the election once', () => {
          before('evaluate the election', async () => {
            await (await CoreElectionModule.evaluateElectionBatch()).wait();
          });

          it('the election is not evaluated', async () => {
            equal(await CoreElectionModule.isElectionEvaluated(), false);
          });

          describe('when completing the batches', () => {
            let nextEpochMembers, nextEpochMemberVotes;
            before('evaluate the election', async () => {
              let finished = await CoreElectionModule.isElectionEvaluated();
              while (!finished) {
                await (await CoreElectionModule.evaluateElectionBatch()).wait();
                finished = await CoreElectionModule.isElectionEvaluated();
              }

              nextEpochMembers = await ElectionStorageMock.getNextEpochMembers();
              nextEpochMemberVotes = await ElectionStorageMock.getNextEpochMemberVotes();
            });

            it('the votes are counted correctly', async () => {
              let nextEpochMemberVotesParsed = nextEpochMemberVotes.map((votes) =>
                votes.toString()
              );

              equal(nextEpochMembers.length, 3);
              deepEqual(nextEpochMembers, [
                candidates[0].address,
                candidates[9].address,
                candidates[8].address,
              ]);
              deepEqual(nextEpochMemberVotesParsed, ['1350', '190', '180']);
            });
          });
        });
      });
    });

    describe('when re-casting votes', async () => {
      let candidates, voters;

      before('identify candidates and voters', async () => {
        candidates = (await ethers.getSigners())
          .slice(2, 7)
          .sort((a, b) => Number(a.address) - Number(b.address));
        voters = (await ethers.getSigners()).slice(2, 7);
      });

      before('set epoch', async () => {
        await (await ElectionStorageMock.initNextEpochMock()).wait();
      });

      before('nominate and setup voters', async () => {
        await Promise.all(
          candidates.map((candidate) => CoreElectionModule.connect(candidate).nominate())
        );

        for (let i = 0; i < voters.length; i++) {
          await ElectionToken.connect(voters[i]).mint(100 + i * 10);
        }
        await ElectionToken.connect(voters[0]).mint(1000);
      });

      after('cleanup voters', async () => {
        for (const voter of voters) {
          await ElectionToken.connect(voter).burn(await ElectionToken.balanceOf(voter.address));
        }
      });

      before('fastForward to voting phase', async () => {
        await fastForward(3 * day, ethers.provider);
      });

      it('is voting phase', async () => {
        equal(await CoreElectionModule.isVoting(), true, 'wrong voting phase');
        assertBignumber.eq(await CoreElectionModule.getPeriodPercent(), 15);
        assertBignumber.eq(await CoreElectionModule.getSeatCount(), 3);
      });

      describe('when casting votes', () => {
        before('cast votes', async () => {
          for (let i = 1; i < voters.length; i++) {
            let candidateIdx = i % candidates.length;
            await CoreElectionModule.connect(voters[i]).elect([candidates[candidateIdx].address]);
          }
        });

        before('voter 0 re-casts the vote', async () => {
          // Before that the winners should be 0, 3 and 4. When voter[0] changes the vote,
          // it changes who wins, and now should be 2, 3 and 4
          await CoreElectionModule.connect(voters[0]).elect([
            candidates[2].address,
            candidates[3].address,
          ]);
        });

        before('fastForward to close voting phase', async () => {
          await fastForward(week, ethers.provider);
        });

        before('set the batch size to fit all candidates', async () => {
          await (await CoreElectionModule.connect(owner).setMaxProcessingBatchSize(10)).wait();
        });

        it('the election is not evaluated', async () => {
          equal(await CoreElectionModule.isElectionEvaluated(), false);
        });

        describe('when evaluating the election', () => {
          let nextEpochMembers, nextEpochMemberVotes;
          before('evaluate the election', async () => {
            await (await CoreElectionModule.evaluateElectionBatch()).wait();
            nextEpochMembers = await ElectionStorageMock.getNextEpochMembers();
            nextEpochMemberVotes = await ElectionStorageMock.getNextEpochMemberVotes();
          });

          it('the election is evaluated', async () => {
            equal(await CoreElectionModule.isElectionEvaluated(), true);
          });

          it('the votes are counted correctly', async () => {
            let nextEpochMemberVotesParsed = nextEpochMemberVotes.map((votes) => votes.toString());

            equal(nextEpochMembers.length, 3);
            deepEqual(nextEpochMembers, [
              candidates[4].address,
              candidates[2].address,
              candidates[3].address,
            ]);
            deepEqual(nextEpochMemberVotesParsed, ['140', '1220', '1230']);
          });
        });
      });
    });
  });
});
