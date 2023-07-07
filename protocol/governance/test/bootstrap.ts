import { coreBootstrap } from '@synthetixio/router/dist/utils/tests';

import type { CoreProxy, AccountProxy } from './generated/typechain';

export interface Contracts {
  CoreProxy: CoreProxy;
  AccountProxy: AccountProxy;
}

const { getProvider, getSigners, getContract, createSnapshot } = coreBootstrap<Contracts>({
  cannonfile: 'cannonfile.toml',
});

const restoreSnapshot = createSnapshot();

export function bootstrap() {
  const contracts: Partial<Contracts> = {};

  before(restoreSnapshot);

  before('load contracts', function () {
    contracts.CoreProxy = getContract('CoreProxy');
    contracts.AccountProxy = getContract('AccountProxy');
  });

  return {
    c: contracts as Contracts,
    getProvider,
    getSigners,
    getContract,
    createSnapshot,
  };
}
