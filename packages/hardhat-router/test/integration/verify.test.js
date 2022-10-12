const path = require('path');
const { deepEqual, rejects, equal } = require('assert/strict');
const { setTimeout } = require('node:timers/promises');
const { task } = require('hardhat/config');
const { TASK_VERIFY_VERIFY } = require('@nomiclabs/hardhat-etherscan/dist/src/constants');
const { TASK_DEPLOY_VERIFY, SUBTASK_LOAD_DEPLOYMENT } = require('../../src/task-names');
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

    it('made the appropiate verify calls', async function () {
      await hre.run(TASK_DEPLOY_VERIFY, { quiet: true, instance: 'test' });

      const contracts = Object.values(hre.router.deployment.general.contracts);
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
        hre.router.deployment.general.properties.completed = false;
        await setTimeout(1);

        try {
          await rejects(() => hre.run(TASK_DEPLOY_VERIFY, { quiet: true, instance: 'test' }), {
            message: 'Cannot verify contracts from a deployment that is not marked as "complete"',
          });
        } finally {
          await hre.run(SUBTASK_LOAD_DEPLOYMENT, { instance: 'test' });
          hre.router.deployment.general.properties.completed = true;
          await setTimeout(1);
        }
      });
    });

    describe('when verifying a single contract', function () {
      it('it correctly verifies it', async function () {
        const contract = 'contracts/modules/SomeModule.sol:SomeModule';

        await hre.run(TASK_DEPLOY_VERIFY, {
          quiet: true,
          instance: 'test',
          contract,
        });

        const SomeModule = Object.values(hre.router.deployment.general.contracts).find(
          (c) => c.contractFullyQualifiedName === contract
        );

        deepEqual(verifyCalls, [
          {
            address: SomeModule.deployedAddress,
            constructorArguments: [],
            contract: SomeModule.contractFullyQualifiedName,
            libraries: {},
          },
        ]);
      });
    });

    describe('when verifying a second deployment', function () {
      before('prepare environment', async function () {
        await deployOnEnvironment(hre, { alias: 'second' });
      });

      it('does not tries to verify the Proxy', async function () {
        await hre.run(TASK_DEPLOY_VERIFY, {
          quiet: true,
          instance: 'test',
        });

        equal(
          verifyCalls.some((c) => c.contract === 'contracts/Proxy.sol:Proxy'),
          false
        );
      });
    });
  });

  describe('when the veryfier throws an unkown error', function () {
    before('mock verify task', function () {
      task(TASK_VERIFY_VERIFY, async function () {
        throw new Error('Unkown error');
      });
    });

    it('throws the error', async function () {
      await rejects(
        () => hre.run(TASK_DEPLOY_VERIFY, { quiet: true, instance: 'test' }),
        new Error('Unkown error')
      );
    });
  });
});
