import { wei } from '@synthetixio/wei';
import { coreBootstrap } from '@synthetixio/router/dist/utils/tests';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { createStakedPool } from '@synthetixio/main/test/common';
import {
  PerpMarketProxy,
  AccountProxy,
  SynthetixUsdCollateralMock,
  WrappedStakedEthCollateralMock,
  PythMock,
  AggregatorV3Mock,
} from './generated/typechain';
import type { IPerpConfigurationModule } from './generated/typechain/PerpConfigurationModule';
import { BigNumber, utils } from 'ethers';
import { createOracleNode } from '@synthetixio/oracle-manager/test/common';

interface Systems extends ReturnType<Parameters<typeof createStakedPool>[0]['systems']> {
  PerpMarketProxy: PerpMarketProxy;
  SynthetixUsdCollateralMock: SynthetixUsdCollateralMock;
  WrappedStakedEthCollateralMock: WrappedStakedEthCollateralMock;
  PythMock: PythMock;
  CollateralMock: SynthetixUsdCollateralMock;
  Collateral2Mock: WrappedStakedEthCollateralMock;
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

  // These mocks are super questionable. I could probably mock everything out within this repo
  // rather than relying on internal Synthetix test code...
  ['synthetix.CollateralMock']: SynthetixUsdCollateralMock;
  ['synthetix.Collateral2Mock']: WrappedStakedEthCollateralMock;
  SynthetixUsdCollateralMock: SynthetixUsdCollateralMock;
  WrappedStakedEthCollateralMock: WrappedStakedEthCollateralMock;
  PerpMarketProxy: PerpMarketProxy;
  AccountProxy: AccountProxy;
  PythMock: PythMock;
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
//
// TODO: These bootstrap methods may have to be reimplemented to not use `before` blocks. However, it might
// be okay for core Synthetix related contracts.
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

// TODO: Refactor all of these implicit before blocks into explicit function calls defined within each test file.
//
// Less magic, more explicit, clearer, slightly more verbose but it allows for properly isolated and less likely
// flakey tests when other devs contribute. Also gives way for better flexibility.

// Added benefit is we can minimise the amount of `let` statements at each `describe` block. Gives way to even less
// opportunity for devs to accidentally use a variable that _may_ be mutative/stateful between tests.
//
// Also use beforeEach more often:
//  - Deploy contracts
//  - Snapshot 1
//  - Provision with reasonable defaults/markets/collateral etc.
//  - Snapshot 2
//  - Run test
//  - Restore to snapshot 2
//  - Restore to snapshot 1 (for perhaps configuration/setup tests)
//
// Doing this for now because no wifi on plane. Everything is probably broken and riddled with compile/type errors.
export const bootstrap = (args: BootstrapArgs) => {
  let systems: Systems;

  const { getContract, getSigners, getProvider } = _bootstraped;

  before(restoreSnapshot);

  before('load contracts', () => {
    systems = {
      Account: getContract('AccountProxy'),
      PerpMarketProxy: getContract('PerpMarketProxy'),
      Core: getContract('synthetix.CoreProxy'),
      USD: getContract('synthetix.USDProxy'),
      OracleManager: getContract('synthetix.oracle_manager.Proxy'),
      SynthetixUsdCollateralMock: getContract('SynthetixUsdCollateralMock'),
      WrappedStakedEthCollateralMock: getContract('WrappedStakedEthCollateralMock'),
      PythMock: getContract('PythMock'),

      // Questionable...
      CollateralMock: getContract('SynthetixUsdCollateralMock'),
      Collateral2Mock: getContract('WrappedStakedEthCollateralMock'),
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

  // before(fn) spam :)

  let hasConfiguredGlobally = false;
  const markets = args.markets.map(({ name, initialPrice, specific }) => {
    const readableName = utils.parseBytes32String(name);
    let oracleNodeId: string, aggregator: AggregatorV3Mock, marketId: BigNumber;

    before(`provision price oracles - ${readableName}`, async () => {
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

    // lolwtf because everything async within before blocks, we have to do this.
    return {
      oracleNodeId: () => oracleNodeId,
      aggregator: () => aggregator,
      marketId: () => marketId,
    };
  });

  const restore = snapshotCheckpoint(stakePool.provider);

  return { ...stakePool, systems: () => systems, restore, markets, poolId };
};

// --- Utility --- //

export const bn = (n: number) => wei(n).toBN();
