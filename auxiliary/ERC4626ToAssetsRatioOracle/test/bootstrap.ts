import { coreBootstrap } from '@synthetixio/router/utils/tests';
import { ethers } from 'ethers';
import { createStakedPool } from '@synthetixio/main/test/common';
import type { ERC4626ToAssetsRatioOracle, WstETHMock } from '../typechain-types';
import { AggregatorV3Mock } from '../typechain-types/contracts/mocks';

type CreateStakePoolSystems = ReturnType<Parameters<typeof createStakedPool>[0]['systems']>;
type OracleManager = CreateStakePoolSystems['OracleManager'];

interface Contracts {
  ERC4626ToAssetsRatioOracle: ERC4626ToAssetsRatioOracle;
  WstETHMock: WstETHMock;
  StEthAggregatorV3MockOracleNode: AggregatorV3Mock;
  ['synthetix.oracle_manager.Proxy']: OracleManager;
}

interface Systems {
  ERC4626ToAssetsRatioOracle: ERC4626ToAssetsRatioOracle;
  WstETHMock: WstETHMock;
  StEthAggregatorV3MockOracleNode: AggregatorV3Mock;
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

  before('bootstrap ERC4626ToAssetsRatioOracle', async function () {
    [owner, user] = getSigners();

    systems = {
      ERC4626ToAssetsRatioOracle: getContract('ERC4626ToAssetsRatioOracle'),
      WstETHMock: getContract('WstETHMock'),
      StEthAggregatorV3MockOracleNode: getContract('StEthAggregatorV3MockOracleNode'),
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
