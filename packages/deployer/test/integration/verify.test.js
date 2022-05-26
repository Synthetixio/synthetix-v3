const path = require('path');
const { deepEqual, rejects } = require('assert/strict');
const { task } = require('hardhat/config');
const { TASK_VERIFY_VERIFY } = require('@nomiclabs/hardhat-etherscan/dist/src/constants');
const { TASK_DEPLOY_VERIFY, SUBTASK_LOAD_DEPLOYMENT } = require('../../task-names');
const { loadEnvironment, deployOnEnvironment } = require('../helpers/use-environment');

describe('deploy:verify', function () {
  let hre;

  before('prepare environment', async function () {
    this.timeout(60000);

    hre = loadEnvironment(
      path.dirname(require.resolve('@synthetixio/sample-project/package.json'))
    );

    await deployOnEnvironment(hre, {
      alias: 'first',
      clear: true,
    });
  });

  describe('when deployoing for the first time', function () {
    let verifyCalls = [];

    before('mock verify task', function () {
      task(TASK_VERIFY_VERIFY, async function (args) {
        verifyCalls.push(args);

        // Include an already verified contract to test all the states
        if (args.contract === 'contracts/modules/TokenModule.sol:TokenModule') {
          throw new Error('Contract source code already verified');
        }
      });
    });

    afterEach('clear verify mock', function () {
      verifyCalls = [];
    });

    before('call to verify', async function () {
      await hre.run(TASK_DEPLOY_VERIFY, { quiet: true, instance: 'test' });
    });

    it('made the appropiate verify calls', async function () {
      const contracts = Object.values(hre.deployer.deployment.general.contracts);
      const expected = contracts.map((c) => {
        const r = {
          address: c.deployedAddress,
          constructorArguments: [],
          contract: c.contractFullyQualifiedName,
          libraries: {},
        };

        if (c.isProxy) {
          const Router = contracts.find((c) => c.isRouter);
          r.constructorArguments.push(Router.deployedAddress);
        }

        return r;
      });

      deepEqual(verifyCalls, expected);
    });

    describe('when trying to verify an incomplete deployment', function () {
      it('throws an error', async function () {
        await hre.run(SUBTASK_LOAD_DEPLOYMENT, { instance: 'test' });
        hre.deployer.deployment.general.properties.completed = false;

        try {
          await rejects(() => hre.run(TASK_DEPLOY_VERIFY, { quiet: true, instance: 'test' }), {
            message: 'Cannot verify contracts from a deployment that is not marked as "complete"',
          });
        } finally {
          await hre.run(SUBTASK_LOAD_DEPLOYMENT, { instance: 'test' });
          hre.deployer.deployment.general.properties.completed = true;
        }
      });
    });
  });
});
