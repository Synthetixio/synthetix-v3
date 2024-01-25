import path from 'node:path';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { ethers } from 'ethers';
import hre from 'hardhat';
import { typedValues } from '../helpers/object';
import { spinChain } from '../helpers/spin-chain';

import type { CoreProxy as SepoliaCoreProxy } from '../generated/typechain/sepolia';
import type { CoreProxy as OptimisticGoerliCoreProxy } from '../generated/typechain/optimistic-goerli';
import type { CoreProxy as AvalancheFujiCoreProxy } from '../generated/typechain/avalanche-fuji';

interface Proxies {
  mothership: SepoliaCoreProxy;
  satellite1: OptimisticGoerliCoreProxy;
  satellite2: AvalancheFujiCoreProxy;
}

export enum ChainSelector {
  mothership = '16015286601757825753',
  satellite1 = '2664363617261496610',
  satellite2 = '14767482510784806043',
}

export interface SignerOnChains {
  mothership: ethers.Signer;
  satellite1: ethers.Signer;
  satellite2: ethers.Signer;
}

export type Chain<TChainProxy> = Awaited<ReturnType<typeof spinChain<TChainProxy>>>;

export interface Chains {
  mothership: Chain<Proxies['mothership']>;
  satellite1: Chain<Proxies['satellite1']>;
  satellite2: Chain<Proxies['satellite2']>;
}

const chains: Chains = {} as unknown as Chains;

let snapshotsIds: string[] = [];
async function createSnapshots() {
  snapshotsIds = await Promise.all(
    typedValues(chains).map((c) => c.provider.send('evm_snapshot', []))
  );
}

async function restoreSnapshots() {
  await Promise.all(
    typedValues(chains).map((c, i) => c.provider.send('evm_revert', [snapshotsIds[i]]))
  );
  await createSnapshots();
}

async function fixtureSignerOnChains() {
  const { address, privateKey } = ethers.Wallet.createRandom();

  const signers = await Promise.all(
    typedValues(chains).map(async (chain) => {
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

async function fastForwardChainsTo(timestamp: number) {
  return await Promise.all(
    Object.values(chains).map((chain) => fastForwardTo(timestamp, chain.provider))
  );
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
    spinChain<Proxies['mothership']>({
      networkName: 'sepolia',
      cannonfile: 'cannonfile.test.toml',
      typechainFolder,
      writeDeployments,
      chainSlector: ChainSelector.mothership,
    }),
    spinChain<Proxies['satellite1']>({
      networkName: 'optimistic-goerli',
      cannonfile: 'cannonfile.satellite.test.toml',
      typechainFolder,
      writeDeployments,
      chainSlector: ChainSelector.satellite1,
    }),
    spinChain<Proxies['satellite2']>({
      networkName: 'avalanche-fuji',
      cannonfile: 'cannonfile.satellite.test.toml',
      typechainFolder,
      writeDeployments,
      chainSlector: ChainSelector.satellite2,
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
    const schedule = await mothership.CoreProxy.getEpochSchedule();
    const councilMembers = await mothership.CoreProxy.getCouncilMembers();
    const epochIndex = await mothership.CoreProxy.getEpochIndex();
    const tx = await satellite.CoreProxy.initElectionModuleSatellite(
      epochIndex,
      schedule.startDate,
      schedule.nominationPeriodStartDate,
      schedule.votingPeriodStartDate,
      schedule.endDate,
      councilMembers
    );
    await tx.wait();
  }
});

before('snapshot checkpoint', createSnapshots);

export function integrationBootstrap() {
  before('back to snapshot', restoreSnapshots);
  return { chains, fixtureSignerOnChains, fastForwardChainsTo };
}
