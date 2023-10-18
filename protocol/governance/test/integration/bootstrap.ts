import path from 'node:path';
import {
  cannonBuild,
  cannonInspect,
} from '@synthetixio/core-modules/test/integration/helpers/cannon';
import { ethers } from 'ethers';
import hre from 'hardhat';
import { glob, runTypeChain } from 'typechain';

import type { CcipRouterMock } from '../generated/typechain/sepolia';
import type { SnapshotRecordMock } from '../generated/typechain/sepolia';
import type { CoreProxy as SepoliaCoreProxy } from '../generated/typechain/sepolia';
import type { CoreProxy as OptimisticGoerliCoreProxy } from '../generated/typechain/optimistic-goerli';
import type { CoreProxy as AvalancheFujiCoreProxy } from '../generated/typechain/avalanche-fuji';

type TestChain = 'sepolia' | 'optimistic-goerli' | 'avalanche-fuji';

interface Proxies {
  Sepolia: SepoliaCoreProxy;
  OptimisticGoerli: OptimisticGoerliCoreProxy;
  AvalancheFuji: AvalancheFujiCoreProxy;
}

export enum ChainSelector {
  Sepolia = '16015286601757825753',
  OptimisticGoerli = '2664363617261496610',
  AvalancheFuji = '14767482510784806043',
}

const ownerAddress = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';

type Mothership = Awaited<ReturnType<typeof _spinNetwork<SepoliaCoreProxy>>>;
type Satellite1 = Awaited<ReturnType<typeof _spinNetwork<OptimisticGoerliCoreProxy>>>;
type Satellite2 = Awaited<ReturnType<typeof _spinNetwork<AvalancheFujiCoreProxy>>>;
type Chains = [Mothership, Satellite1, Satellite2];

export function integrationBootstrap() {
  const mothership: Mothership = {} as unknown as Mothership;
  const satellite1: Satellite1 = {} as unknown as Satellite1;
  const satellite2: Satellite2 = {} as unknown as Satellite2;
  const chains: Chains = [] as unknown as Chains;

  before(`setup chains`, async function () {
    this.timeout(90000);

    const generatedPath = path.resolve(hre.config.paths.tests, 'generated');
    const typechainFolder = path.resolve(generatedPath, 'typechain');
    const writeDeployments = path.resolve(generatedPath, 'deployments');

    /// @dev: show build logs with DEBUG=spawn:*
    // TODO: When running in parallel there's an unknown error that causes to some
    // builds to finish early without throwing error but they do not complete.
    const res = [
      await _spinNetwork<Proxies['Sepolia']>({
        networkName: 'sepolia',
        cannonfile: 'cannonfile.test.toml',
        typechainFolder,
        writeDeployments,
        chainSlector: ChainSelector.Sepolia,
      }),
      await _spinNetwork<Proxies['OptimisticGoerli']>({
        networkName: 'optimistic-goerli',
        cannonfile: 'cannonfile.satellite.test.toml',
        typechainFolder,
        writeDeployments,
        chainSlector: ChainSelector.OptimisticGoerli,
      }),
      await _spinNetwork<Proxies['AvalancheFuji']>({
        networkName: 'avalanche-fuji',
        cannonfile: 'cannonfile.satellite.test.toml',
        typechainFolder,
        writeDeployments,
        chainSlector: ChainSelector.AvalancheFuji,
      }),
    ] satisfies Chains;

    chains.push(...res);
    Object.assign(mothership, res[0]);
    Object.assign(satellite1, res[1]);
    Object.assign(satellite2, res[2]);
  });

  return { chains, mothership, satellite1, satellite2 };
}

async function _spinNetwork<CoreProxy>({
  networkName,
  cannonfile,
  writeDeployments,
  typechainFolder,
  chainSlector,
}: {
  networkName: TestChain;
  cannonfile: string;
  writeDeployments: string;
  typechainFolder: string;
  chainSlector: ChainSelector;
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

  const { artifacts } = await cannonInspect({
    networkName,
    packageRef,
    writeDeployments,
  });

  provider.artifacts = artifacts;

  const allFiles = glob(hre.config.paths.root, [`${writeDeployments}/**/*.json`]);

  await runTypeChain({
    cwd: hre.config.paths.root,
    filesToProcess: allFiles,
    allFiles,
    target: 'ethers-v5',
    outDir: typechainFolder,
  });

  const signer = provider.getSigner(ownerAddress);

  const coreProxy = require(`${writeDeployments}/CoreProxy.json`);
  const CoreProxy = new ethers.Contract(coreProxy.address, coreProxy.abi, signer) as CoreProxy;

  const snapshotRecordMock = require(`${writeDeployments}/SnapshotRecordMock.json`);
  const SnapshotRecordMock = new ethers.Contract(
    snapshotRecordMock.address,
    snapshotRecordMock.abi,
    signer
  ) as SnapshotRecordMock;

  const ccipRouter = require(`${writeDeployments}/CcipRouterMock.json`);
  const CcipRouter = new ethers.Contract(
    ccipRouter.address,
    ccipRouter.abi,
    signer
  ) as CcipRouterMock;

  return {
    networkName,
    chainId,
    chainSlector,
    provider,
    CoreProxy,
    CcipRouter,
    signer,
    SnapshotRecordMock,
  };
}
