const path = require('path');
const { deepEqual, rejects, equal } = require('assert/strict');
const { TASK_DEPLOY_VERIFY_TENDERLY, SUBTASK_LOAD_DEPLOYMENT } = require('../../task-names');
const { loadEnvironment, deployOnEnvironment } = require('../helpers/use-environment');

describe('deploy:verify-tenderly', function () {
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
    let pushCalls = [];

    beforeEach('mock tenderly verify tasks', function () {
      hre.tenderly = {
        verify: (params) => verifyCalls.push(params),
        push: (params) => pushCalls.push(params),
      };
      verifyCalls = [];
      pushCalls = [];
    });

    it('made the appropiate verify calls', async function () {
      await hre.run(TASK_DEPLOY_VERIFY_TENDERLY, { quiet: true, instance: 'test' });

      const contracts = Object.values(hre.deployer.deployment.general.contracts);
      const expected = contracts.map((c) => ({
        address: c.deployedAddress,
        name: c.contractName,
      }));

      deepEqual(verifyCalls, expected);
      deepEqual(pushCalls, expected);
    });

    describe('when trying to verify an incomplete deployment', function () {
      it('throws an error', async function () {
        await hre.run(SUBTASK_LOAD_DEPLOYMENT, { instance: 'test' });
        hre.deployer.deployment.general.properties.completed = false;

        try {
          await rejects(
            () => hre.run(TASK_DEPLOY_VERIFY_TENDERLY, { quiet: true, instance: 'test' }),
            {
              message: 'Cannot verify contracts from a deployment that is not marked as "complete"',
            }
          );
        } finally {
          await hre.run(SUBTASK_LOAD_DEPLOYMENT, { instance: 'test' });
          hre.deployer.deployment.general.properties.completed = true;
        }
      });
    });

    describe('when verifying a single contract', function () {
      it('it correctly verifies it', async function () {
        const contract = 'contracts/modules/SomeModule.sol:SomeModule';

        await hre.run(TASK_DEPLOY_VERIFY_TENDERLY, {
          quiet: true,
          instance: 'test',
          contract,
        });

        const SomeModule = Object.values(hre.deployer.deployment.general.contracts).find(
          (c) => c.contractFullyQualifiedName === contract
        );

        const expected = [
          {
            address: SomeModule.deployedAddress,
            name: SomeModule.contractName,
          },
        ];

        deepEqual(verifyCalls, expected);
        deepEqual(pushCalls, expected);
      });
    });

    describe('when verifying a second deployment', function () {
      before('prepare environment', async function () {
        await deployOnEnvironment(hre, { alias: 'second' });
      });

      it('does not tries to verify the Proxy', async function () {
        await hre.run(TASK_DEPLOY_VERIFY_TENDERLY, {
          quiet: true,
          instance: 'test',
        });

        equal(
          verifyCalls.some((c) => c.contract === 'contracts/Proxy.sol:Proxy'),
          false
        );
        equal(
          pushCalls.some((c) => c.contract === 'contracts/Proxy.sol:Proxy'),
          false
        );
      });
    });
  });
});
