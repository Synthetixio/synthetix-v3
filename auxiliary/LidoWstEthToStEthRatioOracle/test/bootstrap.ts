import { coreBootstrap } from '@synthetixio/router/utils/tests';
import { ethers } from 'ethers';
import { createStakedPool } from '@synthetixio/main/test/common';
import type { LidoWstEthToStEthRatioOracle, WstETHMock } from '../typechain-types';
import { AggregatorV3Mock } from '../typechain-types/contracts/mocks';

type CreateStakePoolSystems = ReturnType<Parameters<typeof createStakedPool>[0]['systems']>;
type OracleManager = CreateStakePoolSystems['OracleManager'];

interface Contracts {
  LidoWstEthToStEthRatioOracle: LidoWstEthToStEthRatioOracle;
  WstETHMock: WstETHMock;
  StEthToEthMock: AggregatorV3Mock;
  ['synthetix.oracle_manager.Proxy']: OracleManager;
}

interface Systems {
  LidoWstEthToStEthRatioOracle: LidoWstEthToStEthRatioOracle;
  WstETHMock: WstETHMock;
  StEthToEthMock: AggregatorV3Mock;
  OracleManager: OracleManager;
}

const params = { cannonfile: 'cannonfile.test.toml' };

const bs = coreBootstrap<Contracts>(params);

export const bootstrap = () => {
  const restore = bs.createSnapshot();
  const { getContract, getExtras, getSigners } = bs;

  let systems: Systems;
  let owner: ethers.Signer;
  let user: ethers.Signer;

  before('bootstrap LidoWstEthToStEthRatioOracle', async function () {
    [owner, user] = getSigners();

    systems = {
      LidoWstEthToStEthRatioOracle: getContract('LidoWstEthToStEthRatioOracle'),
      WstETHMock: getContract('WstETHMock'),
      StEthToEthMock: getContract('StEthToEthMock'),
      OracleManager: getContract('synthetix.oracle_manager.Proxy'),
    };
  });

  return {
    ...bs,
    restore,
    systems: () => systems,
    owner: () => owner,
    user: () => user,
    extras: () => getExtras(),
  };
};
