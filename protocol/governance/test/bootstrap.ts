import { coreBootstrap } from '@synthetixio/router/dist/utils/tests';
import hre from 'hardhat';

import type {
  CoreProxy,
  CouncilToken,
  DebtShareMock,
  BaseElectionProxy,
} from './generated/typechain';

interface Contracts {
  CoreProxy: CoreProxy;
  CouncilToken: CouncilToken;
  DebtShareMock: DebtShareMock;
  BaseElectionProxy: BaseElectionProxy;
}

const { getProvider, getSigners, getContract, createSnapshot } = coreBootstrap<Contracts>({
  cannonfile: 'cannonfile.test.toml',
  settings: [
    // Use always the same date to allow to cache the cannon build. If we leave the default
    // value it will use block.timestamp and generate a new build on each run.
    `initial_epoch_start=${Math.floor(new Date(new Date().getFullYear() + 2, 0).valueOf() / 1000)}`,
  ],
} as { cannonfile: string });

const restoreSnapshot = createSnapshot();

export function bootstrap() {
  const contracts: Partial<Contracts> = {};
  const c = contracts as Contracts;

  before(restoreSnapshot);

  before('load contracts', function () {
    Object.assign(contracts, {
      CoreProxy: getContract('CoreProxy'),
      CouncilToken: getContract('CouncilToken'),
      DebtShareMock: getContract('DebtShareMock'),
      BaseElectionProxy: getContract('BaseElectionProxy'),
    });
  });

  return {
    c,
    getProvider,
    getSigners,
    getContract,
    createSnapshot,

    async deployNewProxy() {
      const [owner] = getSigners();
      const factory = await hre.ethers.getContractFactory('Proxy', owner);
      const NewProxy = await factory.deploy(
        await c.CoreProxy.getImplementation(),
        await owner.getAddress()
      );
      return c.CoreProxy.attach(NewProxy.address);
    },
  };
}
