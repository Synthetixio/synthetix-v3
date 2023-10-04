import { coreBootstrap } from '@synthetixio/router/dist/utils/tests';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { createStakedPool } from '@synthetixio/main/test/common';
import { bootstrapSynthMarkets } from '@synthetixio/spot-market/test/common';
import {
  PerpMarketProxy,
  PerpAccountProxy,
  SnxV3CollateralMock,
  SynthetixCollateral2Mock,
  PythMock,
  AggregatorV3Mock,
} from './generated/typechain';
import type { IMarketConfigurationModule } from './generated/typechain/MarketConfigurationModule';
import { BigNumber, utils, Signer, constants } from 'ethers';
import { createOracleNode } from '@synthetixio/oracle-manager/test/common';
import { CollateralMock } from '../typechain-types';
import { bn, genOneOf } from './generators';
import { SYNTHETIX_USD_MARKET_ID } from './helpers';

type SynthSystems = ReturnType<Awaited<ReturnType<typeof bootstrapSynthMarkets>>['systems']>;

interface Systems extends ReturnType<Parameters<typeof createStakedPool>[0]['systems']> {
  PerpMarketProxy: PerpMarketProxy;
  AggregatorV3Mock: AggregatorV3Mock;
  SpotMarket: SynthSystems['SpotMarket'];
  Synth: SynthSystems['Synth'];
  PythMock: PythMock;
  CollateralMock: CollateralMock;
  Collateral2Mock: CollateralMock;
}

// Hardcoded definition relative to provisioned contracts defined in the toml.
//
// This type is used in `getContract` for mostly autocomplete. Notice there is zero guarantee runtime
// `getContract` calls would be correct. This interface is more likely to just be a subset of provisioned
// contracts in cannon toml.
export interface Contracts {
  ['synthetix.CoreProxy']: Systems['Core'];
  ['synthetix.USDProxy']: Systems['USD'];
  ['synthetix.oracle_manager.Proxy']: Systems['OracleManager'];
  ['spotMarket.SpotMarketProxy']: Systems['SpotMarket'];
  ['spotMarket.SynthRouter']: Systems['Synth'];
  SnxV3CollateralMock: SnxV3CollateralMock;
  SynthetixCollateral2Mock: SynthetixCollateral2Mock;
  PerpMarketProxy: PerpMarketProxy;
  PerpAccountProxy: PerpAccountProxy;
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

export interface GeneratedBootstrap {
  initialEthPrice: BigNumber;
  pool: {
    stakedCollateralPrice: BigNumber;
    stakedAmount: BigNumber;
  };
  global: IMarketConfigurationModule.ConfigureParametersStruct;
  markets: {
    name: string;
    initialPrice: BigNumber;
    specific: IMarketConfigurationModule.ConfigureByMarketParametersStruct;
  }[];
}

export const bootstrap = (args: GeneratedBootstrap) => {
  const { getContract, getSigners, getProvider } = _bootstraped;

  before(restoreSnapshot);

  let systems: Systems;
  before('load contracts', () => {
    systems = {
      Account: getContract('PerpAccountProxy'),
      PerpMarketProxy: getContract('PerpMarketProxy'),
      Core: getContract('synthetix.CoreProxy'),
      USD: getContract('synthetix.USDProxy'),
      OracleManager: getContract('synthetix.oracle_manager.Proxy'),
      AggregatorV3Mock: getContract('AggregatorV3Mock'),
      PythMock: getContract('PythMock'),
      SpotMarket: getContract('spotMarket.SpotMarketProxy'),
      Synth: (address: string) => getContract('spotMarket.SynthRouter', address),
      // Difference between this and `Collateral{2}Mock`?
      //
      // `Collateral{2}Mock` is defined by a `cannon.test.toml` which isn't available here. Both mocks below
      // follow the same ERC20 standard, simply named differently.
      //
      // `CollateralMock` is collateral deposited/delegated configured `args.markets`.
      CollateralMock: getContract('SnxV3CollateralMock'),
      Collateral2Mock: getContract('SynthetixCollateral2Mock'),
    };
  });

  const getOwner = () => getSigners()[0];
  const core = {
    provider: () => getProvider(),
    signers: () => getSigners(),
    owner: () => getOwner(),
    systems: () => systems,
  };

  // Create a pool which makes `args.markets.length` with all equal weighting.
  const stakedPool = createStakedPool(core, args.pool.stakedCollateralPrice, args.pool.stakedAmount);

  // Additional collaterals to provision as spot Synth markets.
  const getCollaterals = () => [
    {
      name: 'swstETH',
      initialPrice: genOneOf([bn(1500), bn(1650), bn(1750), bn(1850), bn(4800)]),
      max: bn(500_000),
    },
    {
      name: 'sAAA',
      initialPrice: genOneOf([bn(10_000), bn(15_000), bn(25_000), bn(30_000)]),
      max: bn(100_000),
    },
  ];

  const spotMarket = bootstrapSynthMarkets(
    getCollaterals().map(({ initialPrice, name }) => ({
      name,
      token: name,
      buyPrice: initialPrice,
      sellPrice: initialPrice,
    })),
    stakedPool
  );

  // Overall market allows up to n collaterals, each having their own oracle node.
  //
  // NOTE: See below for the `before` block below on collateral management.
  const configureCollateral = async () => {
    const collaterals = getCollaterals();

    // Amend sUSD as a collateral to configure.
    const synthMarkets = spotMarket.synthMarkets();
    const synthMarketIds = [SYNTHETIX_USD_MARKET_ID].concat(synthMarkets.map((market) => market.marketId()));
    const maxAllowances = [bn(10_000_000)].concat(collaterals.map(({ max }) => max));

    // Allow this collateral to be depositable into the perp market.
    await systems.PerpMarketProxy.connect(getOwner()).setCollateralConfiguration(synthMarketIds, maxAllowances);

    // TODO: This should be abstracted such that sUSD can be generated and used for all tests.
    return collaterals.map((collateral, idx) => {
      const synthMarket = synthMarkets[idx];
      return {
        ...collateral,
        synthMarket,
        contract: synthMarket.synth(),
        // Why `sellAggregator`? All of BFP only uses `quoteSellExactIn`, so we only need to mock the `sellAggregator`.
        // If we need to buy synths during tests and for whatever reason we cannot just mint with owner, then that can
        // still be referenced via `collateral.synthMarket.buyAggregator()`.
        //
        // @see: `spotMarket.contracts.storage.Price.getCurrentPriceData`
        aggregator: synthMarket.sellAggregator,
        // If you only update the price of the sell aggregator, and try to close a losing position things might fail.
        // sellExactIn is called and will revert with Invalid prices, if they differ too much.
        // Adding a convenient method here to update the prices for both
        updatePrice: async (price: BigNumber) => {
          await synthMarket.sellAggregator().mockSetCurrentPrice(price);
          return synthMarket.buyAggregator().mockSetCurrentPrice(price);
        },
      };
    });
  };

  before(
    'configure global market',
    async () => await systems.PerpMarketProxy.connect(getOwner()).setMarketConfiguration(args.global)
  );

  let ethOracleNodeId: string;
  let ethOracleAgg: AggregatorV3Mock;
  before('configure eth/usd price oracle node', async () => {
    const { oracleNodeId, aggregator } = await createOracleNode(
      getOwner(),
      args.initialEthPrice,
      systems.OracleManager
    );
    await systems.PerpMarketProxy.connect(getOwner()).setEthOracleNodeId(oracleNodeId);

    ethOracleNodeId = oracleNodeId;
    ethOracleAgg = aggregator;
  });

  const markets = args.markets.map(({ name, initialPrice, specific }) => {
    const readableName = utils.parseBytes32String(name);
    let oracleNodeId: string, aggregator: AggregatorV3Mock, marketId: BigNumber;

    before(`provision market price oracle nodes - ${readableName}`, async () => {
      // The market has its own price e.g. ETH/USD. This oracle node is for that.
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

    before(`configure market - ${readableName}`, async () => {
      await systems.PerpMarketProxy.connect(getOwner()).setMarketConfigurationById(marketId, {
        ...specific,
        // Override the generic supplied oracleNodeId with the one that was just created.
        oracleNodeId,
      });
    });

    return {
      oracleNodeId: () => oracleNodeId,
      aggregator: () => aggregator,
      marketId: () => marketId,
    };
  });

  before(`delegate pool collateral to all markets equally`, async () => {
    // Spot market is configured incorrectly, only the last market gets delegated collateral.
    //
    // TODO: We should fix this in bootstrapSynthMarkets when merging into monorepo.
    const spotMarketPoolConfig = spotMarket.synthMarkets().map(({ marketId }) => ({
      marketId: marketId(),
      weightD18: utils.parseEther('1'),
      maxDebtShareValueD18: utils.parseEther('1'),
    }));
    const perpMarketPoolConfig = markets.map(({ marketId }) => ({
      marketId: marketId(),
      weightD18: utils.parseEther('1'),
      maxDebtShareValueD18: utils.parseEther('1'),
    }));
    await systems.Core.connect(getOwner()).setPoolConfiguration(
      stakedPool.poolId,
      spotMarketPoolConfig.concat(perpMarketPoolConfig)
    );
  });

  let collaterals: Awaited<ReturnType<typeof configureCollateral>>;
  before('configure margin collaterals and their prices', async () => {
    collaterals = await configureCollateral();

    // Ensure core system has enough capacity to deposit this collateral for perp market x.
    for (const collateral of collaterals) {
      for (const market of markets) {
        await systems.Core.connect(getOwner()).configureMaximumMarketCollateral(
          market.marketId(),
          collateral.synthMarket.synthAddress(),
          constants.MaxUint256
        );
      }
    }
  });

  let keeper: Signer;
  let keeper2: Signer;
  let keeper3: Signer;
  let endorsedKeeper: Signer;
  const traders: { signer: Signer; accountId: number }[] = [];

  before('configure traders', async () => {
    const { PerpMarketProxy } = systems;
    // `getSigners()` returns a static amount of signers you can test with. The signer at idx=0 is
    // always reserved as the owner but everything else is free game.
    //
    // Here we reserve the [1, 2, 3, 4, 5, 6] as traders and the rest can be for other purposes.
    //
    // 1 = trader
    // 2 = trader
    // 3 = trader
    // 4 = trader
    // 5 = trader
    // 6 = keeper (no funds)
    const [trader1, trader2, trader3, trader4, trader5, _keeper, _keeper2, _keeper3, _endorsedKeeper] =
      getSigners().slice(1);
    keeper = _keeper;
    keeper2 = _keeper2;
    keeper3 = _keeper3;
    endorsedKeeper = _endorsedKeeper;

    const owner = getOwner();
    const createAccountFeature = utils.formatBytes32String('createAccount');
    for (const [i, signer] of [trader1, trader2, trader3, trader4, trader5].entries()) {
      const address = await signer.getAddress();

      // The Synthetix AccountModule has a feature flag that currently prevents anyone from creating an account.
      await PerpMarketProxy.connect(owner).addToFeatureFlagAllowlist(createAccountFeature, address);

      const accountId = i + 10;
      await PerpMarketProxy.connect(signer)['createAccount(uint128)'](accountId);

      traders.push({ signer, accountId });
    }
  });

  before(
    'configure global market',
    async () =>
      await systems.PerpMarketProxy.connect(getOwner()).setMarketConfiguration({
        ...args.global,
        // Replace the mocked endorsedKeeper with a real designated endorsed keeper.
        keeperLiquidationEndorsed: await endorsedKeeper.getAddress(),
      })
  );

  const restore = snapshotCheckpoint(core.provider);

  return {
    ...core,
    args,
    traders: () => traders,
    keeper: () => keeper,
    keeper2: () => keeper2,
    keeper3: () => keeper3,
    endorsedKeeper: () => endorsedKeeper,
    keepers: () => [keeper, keeper2, keeper3, endorsedKeeper],
    restore,
    markets: () => markets,
    collaterals: () => collaterals,
    pool: () => ({
      id: stakedPool.poolId,
      stakerAccountId: stakedPool.accountId,
      stakedAmount: stakedPool.depositAmount,
      collateral: stakedPool.collateralContract,
      oracleNodeId: stakedPool.oracleNodeId,
      aggregator: stakedPool.aggregator,
    }),
    ethOracleNode: () => ({ nodeId: ethOracleNodeId, agg: ethOracleAgg }),
  };
};
