import { wei } from '@synthetixio/wei';
import { coreBootstrap } from '@synthetixio/router/dist/utils/tests';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { createStakedPool } from '@synthetixio/main/test/common';
import {
  PerpMarketProxy,
  AccountProxy,
  SnxCollateralMock,
  SynthetixUsdCollateralMock,
  WrappedStakedEthCollateralMock,
  PythMock,
  AggregatorV3Mock,
} from './generated/typechain';
import type { IPerpConfigurationModule } from './generated/typechain/PerpConfigurationModule';
import { BigNumber, utils } from 'ethers';
import { createOracleNode } from '@synthetixio/oracle-manager/test/common';
import { CollateralMock } from '../typechain-types';

interface Systems extends ReturnType<Parameters<typeof createStakedPool>[0]['systems']> {
  PerpMarketProxy: PerpMarketProxy;
  PythMock: PythMock;
  CollateralMock: CollateralMock;
  Collateral2Mock: CollateralMock;
  Collateral3Mock: CollateralMock;
}

// Hardcoded definition relative to provisioned contracts defined in the toml.
//
// This type is used in `getContract` for mostly autocomplete. Notice there is zero guarantee runtime
// `getContract` calls would be correct. This interface is more likely to just be a subset of provisioned
// contracts in cannon toml.
interface Contracts {
  ['synthetix.CoreProxy']: Systems['Core'];
  ['synthetix.USDProxy']: Systems['USD'];
  ['synthetix.oracle_manager.Proxy']: Systems['OracleManager'];
  SnxCollateralMock: SnxCollateralMock;
  SynthetixUsdCollateralMock: SynthetixUsdCollateralMock;
  WrappedStakedEthCollateralMock: WrappedStakedEthCollateralMock;
  PerpMarketProxy: PerpMarketProxy;
  AccountProxy: AccountProxy;
  PythMock: PythMock;
  AggregatorV3Mock: AggregatorV3Mock;
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
const _bootstraped = coreBootstrap<Contracts>({ cannonfile: 'cannonfile.toml' });
const restoreSnapshot = _bootstraped.createSnapshot();

export interface BootstrapArgs {
  global: IPerpConfigurationModule.ConfigureParametersStruct;
  markets: {
    name: string;
    initialPrice: BigNumber;
    specific: IPerpConfigurationModule.ConfigureByMarketParametersStruct;
  }[];
}

export const bootstrap = (args: BootstrapArgs) => {
  const { getContract, getSigners, getProvider } = _bootstraped;

  before(restoreSnapshot);

  let systems: Systems;
  before('load contracts', () => {
    systems = {
      Account: getContract('AccountProxy'),
      PerpMarketProxy: getContract('PerpMarketProxy'),
      Core: getContract('synthetix.CoreProxy'),
      USD: getContract('synthetix.USDProxy'),
      OracleManager: getContract('synthetix.oracle_manager.Proxy'),
      PythMock: getContract('PythMock'),
      // Difference between this and `Collateral{2}Mock`?
      //
      // `Collateral{2}Mock` is defined by a `cannon.test.toml` which isn't available here. Both mocks below
      // follow the same ERC20 standard, simply named differently.
      //
      // `CollateralMock` is collateral deposited/delegated configured `args.markets`.
      CollateralMock: getContract('SnxCollateralMock'),
      Collateral2Mock: getContract('WrappedStakedEthCollateralMock'),
      Collateral3Mock: getContract('SynthetixUsdCollateralMock'),
    };
  });

  const getOwner = () => getSigners()[0];
  const stakePool = createStakedPool({
    provider: () => getProvider(),
    signers: () => getSigners(),
    owner: () => getOwner(),
    systems: () => systems,
  });

  const { poolId } = stakePool;

  let hasConfiguredGlobally = false;
  const markets = args.markets.map(({ name, initialPrice, specific }) => {
    const readableName = utils.parseBytes32String(name);
    let oracleNodeId: string, aggregator: AggregatorV3Mock, marketId: BigNumber;

    before(`provision price oracle nodes - ${readableName}`, async () => {
      const { oracleNodeId: nodeId, aggregator: agg } = await createOracleNode(
        getOwner(),
        initialPrice,
        systems.OracleManager
      );
      oracleNodeId = nodeId;
      aggregator = agg as AggregatorV3Mock;
    });

    before(`provision market - ${readableName}`, async () => {
      marketId = await systems.PerpMarketProxy.callStatic.createMarket({ name });
      await systems.PerpMarketProxy.createMarket({ name });
    });

    before(`delegate collateral to market - ${name}`, async () => {
      await systems.Core.connect(getOwner()).setPoolConfiguration(poolId, [
        {
          marketId,
          weightD18: utils.parseEther('1'),
          maxDebtShareValueD18: utils.parseEther('1'),
        },
      ]);
    });

    before('configure global market', async () => {
      if (!hasConfiguredGlobally) {
        await systems.PerpMarketProxy.connect(getOwner()).configureMarket(args.global);
      }
    });

    before(`configure market - ${readableName}`, async () => {
      await systems.PerpMarketProxy.connect(getOwner()).configureMarketById(marketId, specific);
    });

    return {
      oracleNodeId: () => oracleNodeId,
      aggregator: () => aggregator,
      marketId: () => marketId,
    };
  });

  const restore = snapshotCheckpoint(stakePool.provider);

  return { ...stakePool, systems: () => systems, restore, markets, poolId };
};

export const bn = (n: number) => wei(n).toBN();
