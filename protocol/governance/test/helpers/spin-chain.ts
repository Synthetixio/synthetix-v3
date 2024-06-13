import path from 'node:path';
import { cannonBuild, cannonInspect } from '@synthetixio/core-modules/test/helpers/cannon';
import { ethers } from 'ethers';
import hre from 'hardhat';
import { glob, runTypeChain } from 'typechain';

import type { CouncilToken } from '../generated/typechain/sepolia';
import type { SnapshotRecordMock } from '../generated/typechain/sepolia';
import type { WormholeMock } from '../generated/typechain/sepolia';
import type { WormholeRelayerMock } from '../generated/typechain/sepolia';

export async function spinChain<GovernanceProxy>({
  networkName,
  cannonfile,
  cannonfileSettings,
  writeDeployments,
  typechainFolder,
  chainSlector,
  ownerAddress = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
}: {
  networkName: string;
  cannonfile: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cannonfileSettings?: { [key: string]: any };
  writeDeployments: string;
  typechainFolder: string;
  chainSlector: string;
  ownerAddress?: string;
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

  console.log('after cannonBuild');

  await cannonInspect({
    chainId,
    packageRef,
    writeDeployments,
  });

  console.log('after cannonInspect');

  const allFiles = glob(hre.config.paths.root, [`${writeDeployments}/**/*.json`]);

  await runTypeChain({
    cwd: hre.config.paths.root,
    filesToProcess: allFiles,
    allFiles,
    target: 'ethers-v5',
    outDir: typechainFolder,
  });

  console.log('after runTypeChain');

  const signer = provider.getSigner(ownerAddress);

  const GovernanceProxy = new ethers.Contract(
    outputs.contracts!.GovernanceProxy.address,
    outputs.contracts!.GovernanceProxy.abi,
    signer
  ) as GovernanceProxy;

  const SnapshotRecordMock = new ethers.Contract(
    outputs.contracts!.SnapshotRecordMock.address,
    outputs.contracts!.SnapshotRecordMock.abi,
    signer
  ) as SnapshotRecordMock;

  // const CcipRouter = new ethers.Contract(
  //   outputs.contracts!.CcipRouterMock.address,
  //   outputs.contracts!.CcipRouterMock.abi,
  //   signer
  // ) as CcipRouterMock;

  const WormholeMock = new ethers.Contract(
    outputs.contracts!.WormholeMock.address,
    outputs.contracts!.WormholeMock.abi,
    signer
  ) as WormholeMock;

  const WormholeRelayerMock = new ethers.Contract(
    outputs.contracts!.WormholeRelayerMock.address,
    outputs.contracts!.WormholeRelayerMock.abi,
    signer
  ) as WormholeRelayerMock;

  const CouncilToken = new ethers.Contract(
    outputs.contracts!.CouncilToken.address,
    outputs.contracts!.CouncilToken.abi,
    signer
  ) as CouncilToken;

  return {
    networkName,
    chainId,
    chainSlector,
    provider: provider as unknown as ethers.providers.JsonRpcProvider,
    GovernanceProxy,
    CouncilToken,
    signer,
    SnapshotRecordMock,
    WormholeMock,
    WormholeRelayerMock,
  };
}
