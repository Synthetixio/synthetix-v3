import { coreBootstrap } from '@synthetixio/core-utils/utils/bootstrap/tests';
import hre from 'hardhat';

import type {
  GovernanceProxy,
  CouncilToken,
  CouncilTokenModule,
  SnapshotRecordMock,
} from './generated/typechain';

interface Contracts {
  GovernanceProxy: GovernanceProxy;
  CouncilToken: CouncilToken;
  CouncilTokenModule: CouncilTokenModule;
  SnapshotRecordMock: SnapshotRecordMock;
}

const { getProvider, getSigners, getContract, createSnapshot } = coreBootstrap<Contracts>({
  cannonfile: 'cannonfile.test.toml',
} as { cannonfile: string });

function snapshotCheckpoint() {
  const restoreSnapshot = createSnapshot();
  after('restore snapshot', restoreSnapshot);
}

export function bootstrap() {
  const contracts: Partial<Contracts> = {};
  const c = contracts as Contracts;

  snapshotCheckpoint();

  before('load contracts', function () {
    Object.assign(contracts, {
      GovernanceProxy: getContract('GovernanceProxy'),
      CouncilToken: getContract('CouncilToken'),
      CouncilTokenModule: getContract('CouncilTokenModule'),
      SnapshotRecordMock: getContract('SnapshotRecordMock'),
    });
  });

  return {
    c,
    getProvider,
    getSigners,
    getContract,
    snapshotCheckpoint,

    async deployNewProxy(implementation?: string) {
      const [owner] = getSigners();
      const factory = await hre.ethers.getContractFactory('Proxy', owner);
      const NewProxy = await factory.deploy(
        implementation || (await c.GovernanceProxy.getImplementation()),
        await owner.getAddress()
      );
      return c.GovernanceProxy.attach(NewProxy.address);
    },
  };
}
