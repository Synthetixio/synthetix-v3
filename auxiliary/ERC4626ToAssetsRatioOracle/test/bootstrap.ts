import { coreBootstrap } from '@synthetixio/core-utils/utils/bootstrap/tests';
import { ethers } from 'ethers';
import { createStakedPool } from '@synthetixio/main/test/common';
import type { ERC4626ToAssetsRatioOracle } from '../typechain-types';
import { ERC20Mock, ERC4626Mock } from '../typechain-types/contracts/mocks';

type CreateStakePoolSystems = ReturnType<Parameters<typeof createStakedPool>[0]['systems']>;
type OracleManager = CreateStakePoolSystems['OracleManager'];

interface Contracts {
  ERC4626ToAssetsRatioOracle: ERC4626ToAssetsRatioOracle;
  ERC20Mock: ERC20Mock;
  ERC4626Mock: ERC4626Mock;
  ['synthetix.oracle_manager.Proxy']: OracleManager;
}

interface Systems {
  ERC4626ToAssetsRatioOracle: ERC4626ToAssetsRatioOracle;
  ERC20Mock: ERC20Mock;
  ERC4626Mock: ERC4626Mock;
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
      ERC20Mock: getContract('ERC20Mock'),
      ERC4626Mock: getContract('ERC4626Mock'),
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
