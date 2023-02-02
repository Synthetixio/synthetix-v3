import { coreBootstrap } from '@synthetixio/hardhat-router/utils/tests';
import { ethers } from 'ethers';
import hre from 'hardhat';
import { snapshotCheckpoint } from '@synthetixio/core-utils/src/utils/cannon/snapshot';

import type { GovernanceProxy } from '../generated/typechain';

export interface Proxies {
  GovernanceProxy: GovernanceProxy;
}

interface Systems {
  Council: GovernanceProxy;
}

const { getProvider, getSigners, getContract, createSnapshot } = coreBootstrap<Proxies>({
  cannonfile: 'cannonfile.test.toml',
});

const restoreSnapshot = createSnapshot();

export let systems: Systems;

before('load system proxies', function () {
  systems = {
    Council: getContract('GovernanceProxy'),
  } as Systems;
});

export function bootstrap() {
  before(restoreSnapshot);

  before('give owner permission to TODO', async () => {
    const [owner] = getSigners();
    // TODO
  });

  return {
    provider: () => getProvider(),
    signers: () => getSigners(),
    owner: () => getSigners()[0],
    systems: () => systems,
  };
}
