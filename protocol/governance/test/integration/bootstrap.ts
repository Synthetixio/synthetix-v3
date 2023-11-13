import path from 'node:path';
import { ccipReceive } from '@synthetixio/core-modules/test/helpers/ccip';
import { ethers } from 'ethers';
import hre from 'hardhat';
import { spinChain } from '../helpers/spin-chain';

import type { CoreProxy as SepoliaCoreProxy } from '../generated/typechain/sepolia';
import type { CoreProxy as OptimisticGoerliCoreProxy } from '../generated/typechain/optimistic-goerli';
import type { CoreProxy as AvalancheFujiCoreProxy } from '../generated/typechain/avalanche-fuji';

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

export interface SignerOnChains {
  mothership: ethers.Signer;
  satellite1: ethers.Signer;
  satellite2: ethers.Signer;
}

export interface Chains {
  mothership: Awaited<ReturnType<typeof spinChain<SepoliaCoreProxy>>>;
  satellite1: Awaited<ReturnType<typeof spinChain<OptimisticGoerliCoreProxy>>>;
  satellite2: Awaited<ReturnType<typeof spinChain<AvalancheFujiCoreProxy>>>;
}

const chains: Chains = {} as unknown as Chains;

let snapshotsIds: string[] = [];
async function createSnapshots() {
  snapshotsIds = await Promise.all(
    Object.values(chains).map((c) => c.provider.send('evm_snapshot', []))
  );
}

async function restoreSnapshots() {
  await Promise.all(
    Object.values(chains).map((c, i) => c.provider.send('evm_revert', [snapshotsIds[i]]))
  );
  await createSnapshots();
}

async function fixtureSignerOnChains() {
  const { address, privateKey } = ethers.Wallet.createRandom();
  const signers = await Promise.all(
    Object.values(chains).map(async (chain) => {
      await chain.provider.send('hardhat_setBalance', [address, `0x${(1e22).toString(16)}`]);
      return new ethers.Wallet(privateKey, chain.provider);
    })
  );

  return {
    mothership: signers[0],
    satellite1: signers[1],
    satellite2: signers[2],
  } satisfies SignerOnChains;
}

before(`setup integration chains`, async function () {
  this.timeout(90000);

  const generatedPath = path.resolve(hre.config.paths.tests, 'generated');
  const typechainFolder = path.resolve(generatedPath, 'typechain');
  const writeDeployments = path.resolve(generatedPath, 'deployments');

  /// @dev: show build logs with DEBUG=spawn:*
  // TODO: When running in parallel there's an unknown error that causes to some
  // builds to finish early without throwing error but they do not complete.
  const [mothership, satellite1, satellite2] = await Promise.all([
    spinChain<Proxies['Sepolia']>({
      networkName: 'sepolia',
      cannonfile: 'cannonfile.test.toml',
      typechainFolder,
      writeDeployments,
      chainSlector: ChainSelector.Sepolia,
    }),
    spinChain<Proxies['OptimisticGoerli']>({
      networkName: 'optimistic-goerli',
      cannonfile: 'cannonfile.satellite.test.toml',
      typechainFolder,
      writeDeployments,
      chainSlector: ChainSelector.OptimisticGoerli,
    }),
    spinChain<Proxies['AvalancheFuji']>({
      networkName: 'avalanche-fuji',
      cannonfile: 'cannonfile.satellite.test.toml',
      typechainFolder,
      writeDeployments,
      chainSlector: ChainSelector.AvalancheFuji,
    }),
  ]);

  Object.assign(chains, {
    mothership,
    satellite1,
    satellite2,
  } satisfies Chains);
});

before('setup election cross chain state', async () => {
  const { mothership, ...satellites } = chains;

  for (const satellite of Object.values(satellites)) {
    const tx = await mothership.CoreProxy.initElectionModuleSatellite(satellite.chainId);
    const rx = await tx.wait();

    await ccipReceive({
      rx,
      sourceChainSelector: mothership.chainSlector,
      targetSigner: satellite.signer,
      ccipAddress: mothership.CcipRouter.address,
    });
  }
});

before('snapshot checkpoint', createSnapshots);

export function integrationBootstrap() {
  before('back to snapshot', restoreSnapshots);
  return { chains, fixtureSignerOnChains };
}
