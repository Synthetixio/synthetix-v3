const { ethers } = hre;
const initializer = require('../../../helpers/initializer');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const { daysToSeconds } = require('@synthetixio/core-js/utils/misc/dates');
const { getTime } = require('@synthetixio/core-js/utils/hardhat/rpc');
const { bnSqrt, BN_TWO } = require('@synthetixio/core-js/utils/ethers/bignumber');
const preInitBehavior = require('@synthetixio/core-modules/test/contracts/modules/election/behaviors/PreInit.behavior');
const badInitBehavior = require('@synthetixio/core-modules/test/contracts/modules/election/behaviors/BadInit.behavior');
const postInitBehavior = require('@synthetixio/core-modules/test/contracts/modules/election/behaviors/PostInit.behavior');
const voteBehavior = require('@synthetixio/core-modules/test/contracts/modules/election/behaviors/Vote.behavior');
const nominationsBehavior = require('@synthetixio/core-modules/test/contracts/modules/election/behaviors/Nomination.behavior');
const dismissalBehavior = require('@synthetixio/core-modules/test/contracts/modules/election/behaviors/Dismissal.behavior');
const evaluationBehavior = require('@synthetixio/core-modules/test/contracts/modules/election/behaviors/Evaluation.behavior');
const resolutionBehavior = require('@synthetixio/core-modules/test/contracts/modules/election/behaviors/Resolution.behavior');
const scheduleBehavior = require('@synthetixio/core-modules/test/contracts/modules/election/behaviors/Schedule.behavior');
const settingsBehavior = require('@synthetixio/core-modules/test/contracts/modules/election/behaviors/Settings.behavior');
const tokenBehavior = require('@synthetixio/core-modules/test/contracts/modules/election/behaviors/CouncilToken.behavior');

describe.only('ElectionModule', () => {
  const { proxyAddress } = bootstrap(initializer);

  async function getElectionModule() {
    return await ethers.getContractAt(
      'contracts/modules/ElectionModule.sol:ElectionModule',
      proxyAddress()
    );
  }

  describe('before the election module is initialized', async function () {
    // preInitBehavior(getElectionModule);
    // badInitBehavior(getElectionModule);
  });

  let receipt, DebtShare;

  async function getInitData() {
    const [member1, member2] = await ethers.getSigners();

    const epochStartDate = await getTime(ethers.provider);
    const epochEndDate = epochStartDate + daysToSeconds(90);
    const votingPeriodStartDate = epochEndDate - daysToSeconds(7);
    const nominationPeriodStartDate = votingPeriodStartDate - daysToSeconds(7);

    return {
      tokenName: 'Synthetix Council Token',
      tokenSymbol: 'SCT',
      firstCouncil: [member1, member2],
      minimumActiveMembers: 1,
      epochStartDate,
      nominationPeriodStartDate,
      votingPeriodStartDate,
      epochEndDate,
      receipt,
      DebtShare,
    };
  }

  describe('after the election module is initialized', function () {
    before('deploy the debt share mock', async function () {
      const factory = await ethers.getContractFactory('DebtShareMock');
      DebtShare = await factory.deploy();
    });

    before('initialize the election module', async function () {
      const ElectionModule = await getElectionModule();

      const initData = await getInitData();

      const tx = await ElectionModule[
        'initializeElectionModule(string,string,address[],uint8,uint64,uint64,uint64,address)'
      ](
        initData.tokenName,
        initData.tokenSymbol,
        initData.firstCouncil.map((member) => member.address),
        initData.minimumActiveMembers,
        initData.nominationPeriodStartDate,
        initData.votingPeriodStartDate,
        initData.epochEndDate,
        DebtShare.address
      );

      receipt = await tx.wait();
    });

    async function getVotePower(user, epochIndex) {
      const debtSharePeriodIdBN = ethers.BigNumber.from(epochIndex + 1);

      return bnSqrt(
        // See DebtShareMock.sol:balanceOfOnPeriod
        debtSharePeriodIdBN.add(BN_TWO).pow(ethers.BigNumber.from(18))
      );
    }

    // postInitBehavior(getElectionModule, getInitData);
    // scheduleBehavior(getElectionModule);
    // settingsBehavior(getElectionModule);
    // nominationsBehavior(getElectionModule);
    // voteBehavior(getElectionModule, getVotePower);
    evaluationBehavior(getElectionModule);
    // resolutionBehavior(getElectionModule, getInitData);
    // dismissalBehavior(getElectionModule);
    // tokenBehavior(getElectionModule, getInitData, proxyAddress);
  });
});
