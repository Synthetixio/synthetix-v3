import { wei } from '@synthetixio/wei';
import { coreBootstrap } from '@synthetixio/router/dist/utils/tests';
import { createStakedPool } from '@synthetixio/main/test/common';
import { PerpMarketProxy } from './generated/typechain/PerpMarketProxy';

type Systems = ReturnType<Parameters<typeof createStakedPool>[0]['systems']>;

// Hardcoded definition relative to provisioned contracts defined in the toml.
//
// This type is used in `getContract` for mostly autocomplete. Notice there is zero guarantee runtime
// `getContract` calls would be correct. This interface is more likely to just be a subset of provisioned
// contracts in cannon toml.
interface Contracts {
  ['synthetix.CoreProxy']: Systems['Core'];
  ['synthetix.USDProxy']: Systems['USD'];
  ['synthetix.oracle_manager.Proxy']: Systems['OracleManager'];
  PerpsMarketProxy: PerpMarketProxy;
  AccountProxy: Systems['Account'];
  CollateralMock: Systems['CollateralMock'];
  Collateral2Mock: Systems['Collateral2Mock'];
  // ['MockPyth']: MockPyth;
}

// A set of intertwined operations occur on `coreBootstrap` invocation. Generally speaking, it:
//
// - Builds contracts using cannon using topology defined by the specified `cannonfile.toml`.
// - Generates TypeScript interfaces via typechain.
// - Using `cannon:build` builds and deploys contracts into a local Anvil runtime.
// - Returns a collection of utility methods contextualised by metadata from cannon for testing.
//
// @see: https://github.com/Synthetixio/synthetix-router/blob/master/src/utils/tests.ts#L23
// @see: https://github.com/usecannon/cannon/blob/main/packages/hardhat-cannon/src/tasks/build.ts
// @see: https://github.com/foundry-rs/foundry/commit/b02dcd26ff2aabc305cee61cd2fa3f7c3a85aad2
//
// Since this invocation is performed at the module root, this will _only_ be executed once no matter
// how many times this bootstrap file is imported.
export const { getProvider, getSigners, getContract, createSnapshot } = coreBootstrap<Contracts>({
  cannonfile: 'cannonfile.toml',
});

export const bootstrap = () => {
  let contracts: Systems;
  before('load contracts', () => {
    contracts = {
      Account: getContract('AccountProxy'),
      Core: getContract('synthetix.CoreProxy'),
      USD: getContract('synthetix.USDProxy'),
      OracleManager: getContract('synthetix.oracle_manager.Proxy'),
      CollateralMock: getContract('CollateralMock'),
      Collateral2Mock: getContract('Collateral2Mock'),
    };
  });

  return createStakedPool({
    provider: () => getProvider(),
    signers: () => getSigners(),
    owner: () => getSigners()[0],
    systems: () => contracts,
  });
};

// --- Utility --- //

export const bn = (n: number) => wei(n).toBN();
