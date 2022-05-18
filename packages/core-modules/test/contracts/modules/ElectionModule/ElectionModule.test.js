const initializer = require('../../../helpers/initializer');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const { getElectionModule, initializeElectionModule } = require('./helpers/election-helper');
const itCanCastVotes = require('./behaviors/Cast.behavior');
const itCanHandleNominations = require('./behaviors/Nominate.behavior');
const itCanDismissMembers = require('./behaviors/Dismiss.behavior');
const itCanEvaluateElections = require('./behaviors/Evaluate.behavior');
const itHandlesInitialization = require('./behaviors/Initialize.behavior');

describe.only('ElectionModule', () => {
  const { proxyAddress } = bootstrap(initializer);

  let ElectionModule;

  before('retrieve the election module', async function () {
    ElectionModule = await getElectionModule(proxyAddress);
  });

  describe('before the election module is initialized', async function () {
    itHandlesInitialization(getElectionModule);
  });

  describe('after the election module is initialized', function () {
    before('initialize the election module', async function () {
      await initializeElectionModule(ElectionModule);
    });

    itCanCastVotes(getElectionModule);
    itCanHandleNominations(getElectionModule);
    itCanDismissMembers(getElectionModule);
    itCanEvaluateElections(getElectionModule);
  });
});
