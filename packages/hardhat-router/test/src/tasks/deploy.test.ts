import { ok, equal, rejects } from 'assert/strict';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployTaskParams, DeployTaskResult } from '../../../src/tasks/deploy';
import { TASK_DEPLOY } from '../../../src/task-names';
import { loadEnvironment } from '../../helpers/use-environment';

async function deploy(
  ctx: Mocha.Context,
  hre: HardhatRuntimeEnvironment,
  options: DeployTaskParams = {}
) {
  ctx.timeout(90000);
  return (await hre.run(TASK_DEPLOY, { quiet: true, ...options })) as DeployTaskResult;
}

describe('tasks/deploy.ts', function () {
  let hre: HardhatRuntimeEnvironment;

  describe('when using a valid project', function () {
    before('prepare environment', async function () {
      hre = loadEnvironment(this, 'sample-deploy');
    });

    // Temporarily skip as it is not working on CI
    describe('when using default configuration', function () {
      it('correctly deploys the architecture', async function () {
        const { contracts } = await deploy(this, hre);

        equal(Object.values(contracts).length, 3);
        ok(contracts.Router);
        ok(contracts.Proxy);
      });
    });

    describe('when skipping Proxy deployment', function () {
      it('correctly finishes', async function () {
        this.timeout(90000);

        const { contracts } = await deploy(this, hre, { skipProxy: true });

        equal(Object.values(contracts).length, 2);
        ok(contracts.Router);
        ok(!contracts.Proxy);
      });
    });

    describe('when setting the same Proxy and Router names', function () {
      it('shows an error', async function () {
        await rejects(
          () =>
            deploy(this, hre, {
              quiet: true,
              proxy: 'contracts/SomeContract.sol:SomeContract',
              router: 'contracts/SomeContract.sol:SomeContract',
            }),
          new Error('Router and Proxy contracts cannot have the same name "SomeContract"')
        );
      });
    });
  });

  describe('when using an environment with missing interfaces', function () {
    before('prepare environment', async function () {
      hre = loadEnvironment(this, 'missing-interface');
    });

    it('throws an error showing the missing interfaces', async function () {
      await rejects(
        () => deploy(this, hre),
        new Error(
          // eslint-disable-next-line max-len
          'Missing interfaces for contracts: Visible function "giveMeSomething" of contract "contracts/modules/SomeModule.sol:SomeModule" not found in the inherited interfaces,Visible function "giveMeSomethingPublic" of contract "contracts/modules/SomeModule.sol:SomeModule" not found in the inherited interfaces'
        )
      );
    });
  });

  describe('when using an environment with namespace collisions', function () {
    before('prepare environment', async function () {
      hre = loadEnvironment(this, 'namespace-collision');
    });

    it('throws an error showing the colliding selectors', async function () {
      await rejects(() => deploy(this, hre), new Error('Found duplicate selectors on contracts'));
    });
  });
});
