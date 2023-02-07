import { coreBootstrap } from '@synthetixio/hardhat-router/utils/tests';
import type { ElectionModule, DebtShareMock } from '../../typechain-types';

export interface Proxies {
  CoreProxy: ElectionModule;
  DebtShareMock: DebtShareMock;
}

interface Systems {
  Council: ElectionModule;
  DebtShare: DebtShareMock;
}

const { getProvider, getSigners, getContract, createSnapshot } = coreBootstrap<Proxies>({
  cannonfile: 'cannonfile.toml',
});

const restoreSnapshot = createSnapshot();

export let systems: Systems;

before('load system proxies', function () {
  systems = {
    Council: getContract('CoreProxy'),
    DebtShare: getContract('DebtShareMock'),
  } as Systems;
});

export function bootstrap() {
  before(restoreSnapshot);

  return {
    provider: () => getProvider(),
    signers: () => getSigners(),
    owner: () => getSigners()[0],
    systems: () => systems,
  };
}
