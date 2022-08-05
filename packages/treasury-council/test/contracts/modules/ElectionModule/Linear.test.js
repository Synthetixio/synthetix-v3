const { ethers } = require('hardhat');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const { parseBalanceMap } = require('@synthetixio/core-js/utils/merkle-tree/parse-balance-tree');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('@synthetixio/core-modules/test/helpers/initializer');
const { getTime, fastForwardTo } = require('@synthetixio/core-js/utils/hardhat/rpc');
const { daysToSeconds } = require('@synthetixio/core-js/utils/misc/dates');

describe('SynthetixElectionModule - treasury-council (linear voting)', function () {
  const { proxyAddress } = bootstrap(initializer);

  const debtShareSnapshotId = 1;

  let ElectionModule, DebtShare;

  let owner, user1, user2;

  let debts;

  before('identify signers', async () => {
    [owner, user1, user2] = await ethers.getSigners();
  });

  before('fixture debts', function () {
    debts = {
      [user2.address]: ethers.utils.parseEther('3').toString(),
    };
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

  before('initialize', async function () {
    const now = await getTime(ethers.provider);
    const epochEndDate = now + daysToSeconds(90);
    const votingPeriodStartDate = epochEndDate - daysToSeconds(7);
    const nominationPeriodStartDate = votingPeriodStartDate - daysToSeconds(7);

    await ElectionModule[
      'initializeElectionModule(string,string,address[],uint8,uint64,uint64,uint64,address)'
    ](
      'Treasury Council Token',
      'SCT',
      [owner.address],
      1,
      nominationPeriodStartDate,
      votingPeriodStartDate,
      epochEndDate,
      DebtShare.address
    );
  });

  before('intialize voting period and debts', async function () {
    await fastForwardTo(await ElectionModule.getNominationPeriodStartDate(), ethers.provider);

    await ElectionModule.setDebtShareSnapshotId(debtShareSnapshotId).then((tx) => tx.wait());

    await DebtShare.setBalanceOfOnPeriod(
      user1.address,
      ethers.utils.parseEther('1'),
      debtShareSnapshotId
    ).then((tx) => tx.wait());

    await DebtShare.setBalanceOfOnPeriod(
      user2.address,
      ethers.utils.parseEther('2'),
      debtShareSnapshotId
    ).then((tx) => tx.wait());

    const merkleTree = parseBalanceMap(debts);

    await ElectionModule.setCrossChainDebtShareMerkleRoot(
      merkleTree.merkleRoot,
      debtShareSnapshotId
    ).then((tx) => tx.wait());

    await fastForwardTo(await ElectionModule.getVotingPeriodStartDate(), ethers.provider);

    await ElectionModule.declareCrossChainDebtShare(
      user2.address,
      merkleTree.claims[user2.address].amount,
      merkleTree.claims[user2.address].proof
    ).then((tx) => tx.wait());
  });

  describe('when getting the voting power', function () {
    describe('when having no voting power', function () {
      it('returns 0 when the user has no power', async function () {
        const wallet = ethers.Wallet.createRandom();
        assertBn.isZero(await ElectionModule.getVotePower(wallet.address));
      });
    });

    describe('when having only debt shares', function () {
      it('returns get power', async function () {
        assertBn.equal(
          await ElectionModule.getVotePower(user1.address),
          ethers.utils.parseEther('1')
        );
      });
    });

    describe('when having shares and cross chain debt', function () {
      before(async function () {});

      it('returns the sum from debt shares and cross chain', async function () {
        assertBn.equal(
          await ElectionModule.getVotePower(user2.address),
          ethers.utils.parseEther('5') // debt share + merkle tree
        );
      });
    });
  });
});
