/* eslint-env mocha */

import hre from 'hardhat';
import { takeSnapshot, restoreSnapshot } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { TASK_DEPLOY } from '../task-names';
import { DeployTaskParams, DeployTaskResult } from '../tasks/deploy';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getHardhatProvider = () => (hre as any).ethers!.provider;

export function bootstrap(
  initializer: (deploymentResult: DeployTaskResult) => void = () => {},
  customDeployOptions: Partial<DeployTaskParams> = {}
) {
  let snapshotId: string;
  let result: DeployTaskResult | null = null;

  before('take a snapshot', async () => {
    snapshotId = await takeSnapshot(getHardhatProvider());
  });

  before('deploy system', async () => {
    const opts: DeployTaskParams = {
      quiet: true,
      ...customDeployOptions,
    };

    result = await hre.run(TASK_DEPLOY, opts);
  });

  before('initialize system', async () => {
    if (!result) {
      throw new Error('Invalid deployment result');
    }

    await initializer(result);
  });

  after('restore the snapshot', async () => {
    await restoreSnapshot(snapshotId, getHardhatProvider());
  });

  const proxyAddress = () => result!.contracts.Proxy.deployedAddress;
  const routerAddress = () => result!.contracts.Router.deployedAddress;

  return { proxyAddress, routerAddress };
}
