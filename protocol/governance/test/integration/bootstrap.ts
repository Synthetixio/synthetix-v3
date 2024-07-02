import path from 'node:path';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { ethers } from 'ethers';
import hre from 'hardhat';
import { typedValues } from '../helpers/object';
import { spinChain } from '../helpers/spin-chain';

import type { GovernanceProxy as SepoliaGovernanceProxy } from '../generated/typechain/sepolia';
import type { GovernanceProxy as OptimisticGoerliGovernanceProxy } from '../generated/typechain/optimistic-sepolia';
import type { GovernanceProxy as AvalancheFujiGovernanceProxy } from '../generated/typechain/avalanche-fuji';

interface Proxies {
  mothership: SepoliaGovernanceProxy;
  satellite1: OptimisticGoerliGovernanceProxy;
  satellite2: AvalancheFujiGovernanceProxy;
}

export enum ChainSelector {
  mothership = '16015286601757825753',
  satellite1 = '2664363617261496610',
  satellite2 = '14767482510784806043',
}

export enum WormholeChainSelector {
  mothership = '10002',
  satellite1 = '10005',
  satellite2 = '43113',
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
  this.timeout(120000);

  const generatedPath = path.resolve(hre.config.paths.tests, 'generated');
  const typechainFolder = path.resolve(generatedPath, 'typechain');
  const writeDeployments = path.resolve(generatedPath, 'deployments');

  /// @dev: show build logs with DEBUG=spawn:*
  const mothership = await spinChain<Proxies['mothership']>({
    networkName: 'sepolia',
    cannonfile: 'cannonfile.test.toml',
    cannonfileSettings: {
      wormhole_chain_id: '10002',
      wormhole_core: '0xBc9C458D6294a40599FB3485fB079429C0732833',
      wormhole_relayer: '0x4235288801B10D43d381E1a7ff495c44EbDD669a',
    },
    typechainFolder,
    writeDeployments,
    chainSlector: ChainSelector.mothership,
  });

  const schedule = await mothership.GovernanceProxy.getEpochSchedule();
  const councilMembers = await mothership.GovernanceProxy.getCouncilMembers();
  const epochIndex = await mothership.GovernanceProxy.getEpochIndex();

  const cannonfileSettings = {
    initial_epoch_index: epochIndex,
    initial_epoch_start_date: schedule.startDate,
    initial_nomination_period_start_date: schedule.nominationPeriodStartDate,
    initial_voting_period_start_date: schedule.votingPeriodStartDate,
    initial_epoch_end_date: schedule.endDate,
    initial_council_member: councilMembers,
  };

  const [satellite1, satellite2] = await Promise.all([
    spinChain<Proxies['satellite1']>({
      networkName: 'optimistic-sepolia',
      cannonfile: 'cannonfile.satellite.test.toml',
      cannonfileSettings: {
        ...cannonfileSettings,
        wormhole_chain_id: '10005',
        wormhole_core: '0x41e689A993322c2B3dE4569084D6F979dc39f095',
        wormhole_relayer: '0xEbCD8Ad722197daaf44E04493837880a09aa0Ea9',
      },
      typechainFolder,
      writeDeployments,
      chainSlector: ChainSelector.satellite1,
    }),
    spinChain<Proxies['satellite2']>({
      networkName: 'avalanche-fuji',
      cannonfile: 'cannonfile.satellite.test.toml',
      cannonfileSettings: {
        ...cannonfileSettings,
        wormhole_chain_id: '43113',
        wormhole_core: '0x40342Cb59035F004043DE1b30C04A69D06C900A2',
        wormhole_relayer: '0x77578945eA23008e40e9Af5AB902999B0A82Ee73',
      },
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

before('snapshot checkpoint', createSnapshots);

export function integrationBootstrap() {
  before('back to snapshot', restoreSnapshots);
  return { chains, fixtureSignerOnChains, fastForwardChainsTo };
}
