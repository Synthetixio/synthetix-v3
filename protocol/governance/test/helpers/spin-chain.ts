import path from 'node:path';
import { cannonBuild } from '@synthetixio/core-utils/utils/bootstrap/cannon-build';
import { cannonInspect } from '@synthetixio/core-utils/utils/bootstrap/cannon-inspect';
import { ethers } from 'ethers';
import hre from 'hardhat';
import { glob, runTypeChain } from 'typechain';

import type { CouncilToken } from '../generated/typechain/sepolia';
import type { SnapshotRecordMock } from '../generated/typechain/sepolia';
import type { WormholeMock } from '../generated/typechain/sepolia';
import type { WormholeRelayerMock } from '../generated/typechain/sepolia';

interface Params {
  networkName: string;
  cannonfile: string;
  cannonfileSettings?: { [key: string]: unknown };
  writeDeployments: string;
  typechainFolder: string;
  ownerAddress?: string;
}

export async function spinChain<GovernanceProxy>({
  networkName,
  cannonfile,
  cannonfileSettings,
  writeDeployments,
  typechainFolder,
  ownerAddress = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
}: Params) {
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

  const { packageRef, provider, outputs } = await cannonBuild({
    cannonfile: path.join(hre.config.paths.root, cannonfile),
    settings: cannonfileSettings,
    chainId,
    impersonate: ownerAddress,
    wipe: true,
    getArtifact: async (contractName: string) =>
      await hre.run('cannon:get-artifact', { name: contractName }),
    pkgInfo: require(path.join(hre.config.paths.root, 'package.json')),
    projectDirectory: hre.config.paths.root,
  });

  await cannonInspect({
    chainId,
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

  const signer = provider.getSigner(ownerAddress);

  const GovernanceProxy = new ethers.Contract(
    outputs.contracts!.GovernanceProxy.address,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    outputs.contracts!.GovernanceProxy.abi as any,
    signer
  ) as GovernanceProxy;

  const SnapshotRecordMock = new ethers.Contract(
    outputs.contracts!.SnapshotRecordMock.address,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    outputs.contracts!.SnapshotRecordMock.abi as any,
    signer
  ) as SnapshotRecordMock;

  const WormholeMock = new ethers.Contract(
    outputs.contracts!.WormholeMock.address,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    outputs.contracts!.WormholeMock.abi as any,
    signer
  ) as WormholeMock;

  const WormholeRelayerMock = new ethers.Contract(
    outputs.contracts!.WormholeRelayerMock.address,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    outputs.contracts!.WormholeRelayerMock.abi as any,
    signer
  ) as WormholeRelayerMock;

  const CouncilToken = new ethers.Contract(
    outputs.contracts!.CouncilToken.address,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    outputs.contracts!.CouncilToken.abi as any,
    signer
  ) as CouncilToken;

  return {
    networkName,
    chainId,
    provider,
    GovernanceProxy,
    CouncilToken,
    signer,
    SnapshotRecordMock,
    WormholeMock,
    WormholeRelayerMock,
  };
}
