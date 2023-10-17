import { coreBootstrap } from '@synthetixio/router/dist/utils/tests';
import hre from 'hardhat';

import type { CoreProxy, CouncilToken, SnapshotRecordMock } from './generated/typechain';
import { ethers } from 'hardhat';

interface Contracts {
  CoreProxy: CoreProxy;
  CouncilToken: CouncilToken;
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
  const voter1 = ethers.Wallet.createRandom();
  const voter2 = ethers.Wallet.createRandom();

  snapshotCheckpoint();

  before('load contracts', function () {
    Object.assign(contracts, {
      CoreProxy: getContract('CoreProxy'),
      CouncilToken: getContract('CouncilToken'),
      SnapshotRecordMock: getContract('SnapshotRecordMock'),
    });
  });

  before('set snapshotRecordMock', async () => {
    await c.CoreProxy.setBalanceOfOnPeriod(voter1, ethers.utils.parseEther('10000'), 0);
    await c.CoreProxy.setBalanceOfOnPeriod(voter2, ethers.utils.parseEther('10000'), 0);
  });

  return {
    c,
    getProvider,
    getSigners,
    getContract,
    snapshotCheckpoint,
    voter1,
    voter2,

    async setVotingPowerOnPeriod(address: string, amount: string, epochIndex: number) {
      await c.CoreProxy.setBalanceOfOnPeriod(address, amount, epochIndex);
    },

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
