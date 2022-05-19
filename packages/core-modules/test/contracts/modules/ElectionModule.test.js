const { ethers } = hre;
const initializer = require('../../helpers/initializer');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const { daysToSeconds } = require('@synthetixio/core-js/utils/misc/dates');
const { getTime } = require('@synthetixio/core-js/utils/hardhat/rpc');
const preInitBehavior = require('./election/behaviors/PreInit.behavior');
const badInitBehavior = require('./election/behaviors/BadInit.behavior');
const postInitBehavior = require('./election/behaviors/PostInit.behavior');
const voteBehavior = require('./election/behaviors/Vote.behavior');
const nominationsBehavior = require('./election/behaviors/Nomination.behavior');
const dismissalBehavior = require('./election/behaviors/Dismissal.behavior');
const evaluationBehavior = require('./election/behaviors/Evaluation.behavior');
const resolutionBehavior = require('./election/behaviors/Resolution.behavior');
const scheduleBehavior = require('./election/behaviors/Schedule.behavior');
const settingsBehavior = require('./election/behaviors/Settings.behavior');
const tokenBehavior = require('./election/behaviors/CouncilToken.behavior');

describe('ElectionModule', () => {
  const { proxyAddress } = bootstrap(initializer);

  async function getElectionModule() {
    return await ethers.getContractAt(
      'contracts/modules/ElectionModule.sol:ElectionModule',
      proxyAddress()
    );
  }

  describe('before the election module is initialized', async function () {
    preInitBehavior(getElectionModule);
    badInitBehavior(getElectionModule);
  });

  let receipt;

  async function getInitData() {
    const [member1, member2] = await ethers.getSigners();

    const epochStartDate = await getTime(ethers.provider);
    const epochEndDate = epochStartDate + daysToSeconds(90);
    const votingPeriodStartDate = epochEndDate - daysToSeconds(7);
    const nominationPeriodStartDate = votingPeriodStartDate - daysToSeconds(7);

    return {
      tokenName: 'Some Council Token',
      tokenSymbol: 'SCT',
      firstCouncil: [member1, member2],
      minimumActiveMembers: 1,
      epochStartDate,
      nominationPeriodStartDate,
      votingPeriodStartDate,
      epochEndDate,
      receipt,
    };
  }

  describe('after the election module is initialized', function () {
    before('initialize the election module', async function () {
      const ElectionModule = await getElectionModule();

      const initData = await getInitData();

      const tx = await ElectionModule.initializeElectionModule(
        initData.tokenName,
        initData.tokenSymbol,
        initData.firstCouncil.map((member) => member.address),
        initData.minimumActiveMembers,
        initData.nominationPeriodStartDate,
        initData.votingPeriodStartDate,
        initData.epochEndDate
      );

      receipt = await tx.wait();
    });

    postInitBehavior(getElectionModule, getInitData);
    scheduleBehavior(getElectionModule);
    settingsBehavior(getElectionModule);
    nominationsBehavior(getElectionModule);
    voteBehavior(getElectionModule);
    evaluationBehavior(getElectionModule);
    resolutionBehavior(getElectionModule, getInitData);
    dismissalBehavior(getElectionModule);
    tokenBehavior(getElectionModule, getInitData, proxyAddress);
  });
});
