import { coreBootstrap } from '@synthetixio/router/dist/utils/tests';

import type {
  CoreProxy,
  AccountProxy,
  CoreRouter,
  DebtShareMock,
  CouncilTokenRouter,
} from './generated/typechain';

interface Contracts {
  CoreRouter: CoreRouter;
  CoreProxy: CoreProxy;
  AccountProxy: AccountProxy;
  CouncilTokenRouter: CouncilTokenRouter;
  DebtShareMock: DebtShareMock;
}

const { getProvider, getSigners, getContract, createSnapshot } = coreBootstrap<Contracts>({
  cannonfile: 'cannonfile.test.toml',
  settings: [`epoch_start=${Math.ceil(Date.now() / 1000 + 604800)}`],
} as { cannonfile: string });

const restoreSnapshot = createSnapshot();

export function bootstrap() {
  const contracts: Partial<Contracts> = {};

  before(restoreSnapshot);

  before('load contracts', function () {
    contracts.CoreRouter = getContract('CoreRouter');
    contracts.CoreProxy = getContract('CoreProxy');
    contracts.AccountProxy = getContract('AccountProxy');
    contracts.DebtShareMock = getContract('DebtShareMock');
    contracts.CouncilTokenRouter = getContract('CouncilTokenRouter');
  });

  return {
    c: contracts as Contracts,
    getProvider,
    getSigners,
    getContract,
    createSnapshot,
  };
}
