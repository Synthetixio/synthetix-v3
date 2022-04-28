const { ethers } = hre;
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const { parseBalanceMap } = require('@synthetixio/core-js/utils/merkle-tree/parse-balance-tree');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../../../../spartan-council/test/helpers/initializer');
const { daysToSeconds } = require('@synthetixio/core-js/utils/misc/dates');
const { getTime, fastForwardTo } = require('@synthetixio/core-js/utils/hardhat/rpc');
const {
  expectedVotePowerForDebtSharePeriodId,
  expectedVotePowerForSpecificDebtShare,
} = require('./helpers/election-helper');

describe('SynthetixElectionModule (L1 + L2 debt share)', function () {
  const { proxyAddress } = bootstrap(initializer);

  let signers, l1voters, members, owner, user1, user2, user3, user4;

  let parsedTree, validRoot;

  let DebtShare, SynthetixElectionModule;

  const TEN = '10000000000000000000';
  const HUNDRED = '100000000000000000000';

  before('identify accounts', async () => {
    signers = await ethers.getSigners();

    [owner, user1, user2, user3, user4, ...l1voters] = signers;

    members = [owner, user1, user2, user3, user4];
  });

  before('build L1 tree and related data', () => {
    const inputData = {};

    for (const voter of l1voters) {
      inputData[voter.address] = TEN;
    }

    inputData[l1voters[0].address] = HUNDRED;

    parsedTree = parseBalanceMap(inputData);

    validRoot = parsedTree.merkleRoot;
  });

  before('identify contracts', async function () {
    const factory = await ethers.getContractFactory('DebtShareMock');
    DebtShare = await factory.deploy();

    SynthetixElectionModule = await ethers.getContractAt(
      'contracts/modules/SynthetixElectionModule.sol:SynthetixElectionModule',
      proxyAddress()
    );
  });

  before('initialize election', async function () {
    const now = await getTime(ethers.provider);
    const epochEndDate = now + daysToSeconds(90);
    const votingPeriodStartDate = epochEndDate - daysToSeconds(7);
    const nominationPeriodStartDate = votingPeriodStartDate - daysToSeconds(7);

    await SynthetixElectionModule.initializeSynthetixElectionModule(
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

  before('nominate tasks', async function () {
    await fastForwardTo(
      await SynthetixElectionModule.getNominationPeriodStartDate(),
      ethers.provider
    );

    // nominate members
    for (const member of members) {
      await SynthetixElectionModule.connect(member).nominate();
    }

    // set merkle root
    const tx = await SynthetixElectionModule.connect(owner).setCrossChainDebtShareMerkleRoot(
      validRoot,
      42
    );
    await tx.wait();
  });

  describe('when casting votes', () => {
    before('fastforward to voting period', async function () {
      await fastForwardTo(
        await SynthetixElectionModule.getVotingPeriodStartDate(),
        ethers.provider
      );
    });

    describe('when casting votes with an address with debt share only on L1', () => {
      let voter;

      before('declare L1 debt share', async () => {
        voter = l1voters[1].address;

        const tx = await SynthetixElectionModule.declareCrossChainDebtShare(
          voter,
          parsedTree.claims[voter].amount,
          parsedTree.claims[voter].proof
        );
        await tx.wait();
      });

      before('set L2 debt share', async () => {
        const tx = await DebtShare.setBalanceOf(voter, 0);
        await tx.wait();
      });

      before('cast vote', async () => {
        await SynthetixElectionModule.connect(l1voters[1]).cast([members[0].address]);
      });

      it('shows that has the expected vote power', async () => {
        assertBn.equal(
          await SynthetixElectionModule.getVotePower(voter),
          await expectedVotePowerForSpecificDebtShare(parsedTree.claims[voter].amount)
        );
      });

      it('candidate should have the right amount of votes', async () => {
        const ballotId = await SynthetixElectionModule.getBallotVoted(voter);

        assertBn.equal(
          await SynthetixElectionModule.getBallotVotes(ballotId),
          await expectedVotePowerForSpecificDebtShare(parsedTree.claims[voter].amount)
        );
      });
    });

    describe('when casting votes with an address with debt share only on L2', () => {
      before('cast vote', async () => {
        await SynthetixElectionModule.connect(user1).cast([members[1].address]);
      });

      it('shows that has the expected vote power', async () => {
        assertBn.equal(
          await SynthetixElectionModule.getVotePower(user1.address),
          await expectedVotePowerForDebtSharePeriodId(1)
        );
      });

      it('shows that candidate has the expected amount of votes', async () => {
        const ballotId = await SynthetixElectionModule.getBallotVoted(user1.address);

        assertBn.equal(
          await SynthetixElectionModule.getBallotVotes(ballotId),
          await expectedVotePowerForDebtSharePeriodId(1)
        );
      });
    });

    describe('when casting votes with an address with debt share on L1 and L2', () => {
      let voter;

      before('declare L1 debt share', async () => {
        voter = l1voters[2].address;

        const tx = await SynthetixElectionModule.declareCrossChainDebtShare(
          voter,
          parsedTree.claims[voter].amount,
          parsedTree.claims[voter].proof
        );
        await tx.wait();
      });

      before('set L2 debt share', async () => {
        const tx = await DebtShare.setBalanceOf(voter, TEN);
        await tx.wait();
      });

      before('cast vote', async () => {
        await SynthetixElectionModule.connect(l1voters[2]).cast([members[2].address]);
      });

      it('shows that has the expected vote power', async () => {
        const expectedVotePower = ethers.BigNumber.from(parsedTree.claims[voter].amount).add(TEN);

        assertBn.equal(
          await SynthetixElectionModule.getVotePower(voter),
          await expectedVotePowerForSpecificDebtShare(expectedVotePower)
        );
      });

      it('shows that candidate has the expected amount of votes', async () => {
        const expectedVotePower = ethers.BigNumber.from(parsedTree.claims[voter].amount).add(TEN);

        const ballotId = await SynthetixElectionModule.getBallotVoted(voter);

        assertBn.equal(
          await SynthetixElectionModule.getBallotVotes(ballotId),
          await expectedVotePowerForSpecificDebtShare(expectedVotePower)
        );
      });
    });

    describe('when re-casting votes with an address with debt share on L1 and L2', () => {
      let voter;

      before('identify voter', async () => {
        voter = l1voters[0].address;
      });

      before('set L2 debt share', async () => {
        const tx = await DebtShare.setBalanceOf(voter, TEN);
        await tx.wait();
      });

      describe('when casting vote for the first time (without declaring L1 debt)', () => {
        before('cast vote', async () => {
          await SynthetixElectionModule.connect(l1voters[0]).cast([members[3].address]);
        });

        it('shows that has the expected vote power', async () => {
          assertBn.equal(
            await SynthetixElectionModule.getVotePower(voter),
            await expectedVotePowerForSpecificDebtShare(TEN)
          );
        });

        it('shows that candidate has the expected amount of votes', async () => {
          const ballotId = await SynthetixElectionModule.getBallotVoted(voter);

          assertBn.equal(
            await SynthetixElectionModule.getBallotVotes(ballotId),
            await expectedVotePowerForSpecificDebtShare(TEN)
          );
        });

        describe('when re-casting vote declaring L1 debt', () => {
          before('declare L1 debt share', async () => {
            const tx = await SynthetixElectionModule.declareCrossChainDebtShare(
              voter,
              parsedTree.claims[voter].amount,
              parsedTree.claims[voter].proof
            );
            await tx.wait();
          });

          before('another user cast vote', async () => {
            await SynthetixElectionModule.connect(user2).cast([members[3].address]);
          });

          before('voter re-cast vote', async () => {
            await SynthetixElectionModule.connect(l1voters[0]).cast([members[4].address]);
          });

          it('shows that has the expected vote power', async () => {
            const expectedVotePower = ethers.BigNumber.from(parsedTree.claims[voter].amount).add(
              TEN
            );

            assertBn.equal(
              await SynthetixElectionModule.getVotePower(voter),
              await expectedVotePowerForSpecificDebtShare(expectedVotePower)
            );
          });

          it('shows that previous candidate has the expected amount of votes', async () => {
            const ballotId = await SynthetixElectionModule.getBallotVoted(user2.address);

            assertBn.equal(
              await SynthetixElectionModule.getBallotVotes(ballotId),
              await expectedVotePowerForDebtSharePeriodId(1)
            );
          });

          it('shows that new candidate has the expected amount of votes', async () => {
            const ballotId = await SynthetixElectionModule.getBallotVoted(voter);

            const expectedVotePower = ethers.BigNumber.from(parsedTree.claims[voter].amount).add(
              TEN
            );

            assertBn.equal(
              await SynthetixElectionModule.getBallotVotes(ballotId),
              await expectedVotePowerForSpecificDebtShare(expectedVotePower)
            );
          });
        });
      });
    });
  });
});
