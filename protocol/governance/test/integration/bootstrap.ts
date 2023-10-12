import path from 'node:path';
import {
  cannonBuild,
  cannonInspect,
  cannonRun,
} from '@synthetixio/core-modules/test/integration/helpers/cannon';
import { ethers } from 'ethers';
import hre from 'hardhat';
import { glob, runTypeChain } from 'typechain';

type TestChain = 'sepolia' | 'optimistic-goerli' | 'avalanche-fuji';

interface Chain {
  networkName: TestChain;
  chainId: number;
  provider: ethers.providers.JsonRpcProvider;
}

const ownerAddress = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';

export function integrationBootstrap() {
  const chains: Chain[] = [];

  before(`setup chains`, async function () {
    this.timeout(90000);

    const generatedPath = path.resolve(hre.config.paths.tests, 'generated');
    const typechainFolder = path.resolve(generatedPath, 'typechain');
    const writeDeployments = path.resolve(generatedPath, 'deployments');

    /// @dev: show build logs with DEBUG=synthetix:core-modules:spawn
    const res = await Promise.all([
      _spinNetwork({
        networkName: 'sepolia',
        cannonfile: 'cannonfile.test.toml',
        typechainFolder,
        writeDeployments,
      }),
      _spinNetwork({
        networkName: 'optimistic-goerli',
        cannonfile: 'cannonfile.satellite.test.toml',
        typechainFolder,
        writeDeployments,
      }),
      _spinNetwork({
        networkName: 'avalanche-fuji',
        cannonfile: 'cannonfile.satellite.test.toml',
        typechainFolder,
        writeDeployments,
      }),
    ]);

    chains.push(...res);
  });

  return { chains };
}

async function _spinNetwork({
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

  const { packageRef } = await cannonBuild({
    cannonfile,
    networkName,
    chainId,
    impersonate: ownerAddress,
    wipe: true,
  });

  console.log(`  Running: ${packageRef} - Network: ${networkName}`);

  const { provider } = await cannonRun({
    networkName,
    packageRef,
  });

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

  return { networkName, chainId, provider };
}
