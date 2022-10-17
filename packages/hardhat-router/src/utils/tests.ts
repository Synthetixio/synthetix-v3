/* eslint-env mocha */

import hre from 'hardhat';
import { takeSnapshot, restoreSnapshot } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { TASK_DEPLOY } from '../task-names';
import type { DeployTaskParams } from '../tasks/deploy';
import { DeploymentInfo, getProxyAddress, getRouterAddress } from './deployments';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getHardhatProvider = () => (hre as any).ethers!.provider;

export function bootstrap(
  initializer: (deploymentInfo: Partial<DeploymentInfo>) => void = () => {},
  customDeployOptions: DeployTaskParams = {}
) {
  let snapshotId: string;

  const deploymentInfo = {
    network: hre.network.name,
    instance: customDeployOptions.instance || 'test',
  };

  before('take a snapshot', async () => {
    snapshotId = await takeSnapshot(getHardhatProvider());
  });

  before('deploy system', async () => {
    await hre.run(TASK_DEPLOY, {
      instance: deploymentInfo.instance,
      clear: true,
      noConfirm: true,
      quiet: true,
      ...customDeployOptions,
    });
  });

  before('initialize system', async () => {
    await initializer(deploymentInfo);
  });

  after('restore the snapshot', async () => {
    await restoreSnapshot(snapshotId, getHardhatProvider());
  });

  const proxyAddress = () => getProxyAddress(deploymentInfo);
  const routerAddress = () => getRouterAddress(deploymentInfo);

  return { deploymentInfo, proxyAddress, routerAddress };
}
