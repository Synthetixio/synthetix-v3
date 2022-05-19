const initializer = require('../../../helpers/initializer');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const { getElectionModule } = require('./helpers/election-helper');
const { daysToSeconds } = require('@synthetixio/core-js/utils/misc/dates');
const { getTime } = require('@synthetixio/core-js/utils/hardhat/rpc');
const preInitBehavior = require('./behaviors/PreInit.behavior');
const badInitBehavior = require('./behaviors/BadInit.behavior');
const postInitBehavior = require('./behaviors/PostInit.behavior');
const voteBehavior = require('./behaviors/Vote.behavior');
const nominationsBehavior = require('./behaviors/Nomination.behavior');
const dismissalBehavior = require('./behaviors/Dismissal.behavior');
const evaluationBehavior = require('./behaviors/Evaluation.behavior');
const resolutionBehavior = require('./behaviors/Resolution.behavior');

describe.only('ElectionModule', () => {
  const { proxyAddress } = bootstrap(initializer);

  async function getElectionModule() {
    return await ethers.getContractAt('contracts/modules/ElectionModule.sol:ElectionModule', proxyAddress());
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
      receipt
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
    nominationsBehavior(getElectionModule);
    voteBehavior(getElectionModule);
    evaluationBehavior(getElectionModule);
    dismissalBehavior(getElectionModule);
    resolutionBehavior(getElectionModule, getInitData);
  });
});
