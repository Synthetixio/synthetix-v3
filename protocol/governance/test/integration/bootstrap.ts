import path from 'node:path';
import {
  cannonBuild,
  cannonInspect,
} from '@synthetixio/core-modules/test/integration/helpers/cannon';
import { ethers } from 'ethers';
import hre from 'hardhat';
import { glob, runTypeChain } from 'typechain';

import type { CcipRouterMock } from '../generated/typechain/sepolia';
import type { CoreProxy as SepoliaCoreProxy } from '../generated/typechain/sepolia';
import type { CoreProxy as OptimisticGoerliCoreProxy } from '../generated/typechain/optimistic-goerli';
import type { CoreProxy as AvalancheFujiCoreProxy } from '../generated/typechain/avalanche-fuji';

type TestChain = 'sepolia' | 'optimistic-goerli' | 'avalanche-fuji';

const ownerAddress = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';

type Chains = [
  Awaited<ReturnType<typeof _spinNetwork<SepoliaCoreProxy>>>,
  Awaited<ReturnType<typeof _spinNetwork<OptimisticGoerliCoreProxy>>>,
  Awaited<ReturnType<typeof _spinNetwork<AvalancheFujiCoreProxy>>>,
];

export function integrationBootstrap() {
  const chains: Chains = [] as unknown as Chains;

  before(`setup chains`, async function () {
    this.timeout(90000);

    const generatedPath = path.resolve(hre.config.paths.tests, 'generated');
    const typechainFolder = path.resolve(generatedPath, 'typechain');
    const writeDeployments = path.resolve(generatedPath, 'deployments');

    /// @dev: show build logs with DEBUG=synthetix:core-modules:spawn
    const res = (await Promise.all([
      _spinNetwork<SepoliaCoreProxy>({
        networkName: 'sepolia',
        cannonfile: 'cannonfile.test.toml',
        typechainFolder,
        writeDeployments,
      }),
      _spinNetwork<OptimisticGoerliCoreProxy>({
        networkName: 'optimistic-goerli',
        cannonfile: 'cannonfile.satellite.test.toml',
        typechainFolder,
        writeDeployments,
      }),
      _spinNetwork<AvalancheFujiCoreProxy>({
        networkName: 'avalanche-fuji',
        cannonfile: 'cannonfile.satellite.test.toml',
        typechainFolder,
        writeDeployments,
      }),
    ])) satisfies Chains;

    chains.push(...res);
  });

  return { chains };
}

async function _spinNetwork<CoreProxy>({
  networkName,
  cannonfile,
  writeDeployments,
  typechainFolder,
}: {
  networkName: TestChain;
  cannonfile: string;
  writeDeployments: string;
  typechainFolder: string;
}) {
  if (!hre.config.networks[networkName]) {
    throw new Error(`Invalid network "${networkName}"`);
  }

  const { chainId } = hre.config.networks[networkName];

  if (typeof chainId !== 'number') {
    throw new Error(`Invalid chainId on network ${networkName}`);
  }

  writeDeployments = path.join(writeDeployments, networkName);
  typechainFolder = path.join(typechainFolder, networkName);

  console.log(`  Building: ${cannonfile} - Network: ${networkName}`);

  const { packageRef, provider } = await cannonBuild({
    cannonfile,
    networkName,
    chainId,
    impersonate: ownerAddress,
    wipe: true,
  });

  console.log(`  Running: ${packageRef} - Network: ${networkName}`);

  await cannonInspect({
    networkName,
    packageRef,
    writeDeployments,
  });

  const allFiles = glob(hre.config.paths.root, [`${writeDeployments}/**/*.json`]);

  await runTypeChain({
    cwd: hre.config.paths.root,
    filesToProcess: allFiles,
    allFiles,
    target: 'ethers-v5',
    outDir: typechainFolder,
  });

  const signer = await provider.getSigner(ownerAddress);

  const coreProxy = require(`${writeDeployments}/CoreProxy.json`);
  const CoreProxy = new ethers.Contract(coreProxy.address, coreProxy.abi, signer) as CoreProxy;

  const ccipRouter = require(`${writeDeployments}/CcipRouterMock.json`);
  const CcipRouter = new ethers.Contract(
    ccipRouter.address,
    ccipRouter.abi,
    signer
  ) as CcipRouterMock;

  return { networkName, chainId, provider, CoreProxy, CcipRouter };
}
