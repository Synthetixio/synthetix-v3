import { BigNumber, utils, Signer, constants } from 'ethers';
import { coreBootstrap } from '@synthetixio/router/utils/tests';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { createStakedPool } from '@synthetixio/main/test/common';
import { createOracleNode } from '@synthetixio/oracle-manager/test/common';
import { PerpMarketProxy, PerpAccountProxy, AggregatorV3Mock, PythMock } from './generated/typechain';
import { CollateralMock, SettlementHookMock } from '../typechain-types';
import { bn, genOneOf } from './generators';
import { bootstrapSynthMarkets } from './external/bootstrapSynthMarkets';
import { ADDRESS0, SYNTHETIX_USD_MARKET_ID, sleep } from './helpers';
import { formatBytes32String } from 'ethers/lib/utils';
import type { WstETHMock } from '../typechain-types/contracts/mocks/WstETHMock';
import { GeneratedBootstrap } from './typed';

type SynthSystems = ReturnType<Awaited<ReturnType<typeof bootstrapSynthMarkets>>['systems']>;

interface Systems extends ReturnType<Parameters<typeof createStakedPool>[0]['systems']> {
  PerpMarketProxy: PerpMarketProxy;
  AggregatorV3Mock: AggregatorV3Mock;
  SpotMarket: SynthSystems['SpotMarket'];
  Synth: SynthSystems['Synth'];
  PythMock: PythMock;
  CollateralMock: CollateralMock;
  Collateral2Mock: CollateralMock;
  WstETHMock: WstETHMock;
  StEthMock: AggregatorV3Mock;
  StEthToEthMock: AggregatorV3Mock;
  SettlementHookMock: SettlementHookMock;
  SettlementHook2Mock: SettlementHookMock;
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
  ['pyth.Pyth']: PythMock;
  CollateralMock: CollateralMock;
  Collateral2Mock: CollateralMock;
  PerpMarketProxy: PerpMarketProxy;
  PerpAccountProxy: PerpAccountProxy;
  AggregatorV3Mock: AggregatorV3Mock;
  WstETHMock: WstETHMock;
  StEthMock: AggregatorV3Mock;
  StEthToEthMock: AggregatorV3Mock;
  SettlementHookMock: SettlementHookMock;
  SettlementHook2Mock: SettlementHookMock;
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

export interface PerpCollateral {
  name: string;
  initialPrice: BigNumber;
  max: BigNumber;
  contract:
    | Systems['USD']
    | ReturnType<ReturnType<ReturnType<typeof bootstrapSynthMarkets>['synthMarkets']>[number]['synth']>;
  synthMarketId: () => BigNumber;
  synthAddress: () => string;
  oracleNodeId: () => string;
  rewardDistributorAddress: () => string;
  getPrice: () => Promise<BigNumber>;
  setPrice: (price: BigNumber) => Promise<void>;
}

export const bootstrap = (args: GeneratedBootstrap) => {
  const { getContract, getSigners, getExtras, getProvider } = _bootstraped;

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
      PythMock: getContract('pyth.Pyth'),
      SpotMarket: getContract('spotMarket.SpotMarketProxy'),
      // @ts-ignore
      Synth: (address: string) => getContract('spotMarket.SynthRouter', address), // Misaligned types from spotMarket type compilation.
      // Difference between this and `Collateral{2}Mock`?
      //
      // `Collateral{2}Mock` is defined by a `cannon.test.toml` which isn't available here. Both mocks below
      // follow the same ERC20 standard, simply named differently.
      //
      // `CollateralMock` is collateral deposited/delegated configured `args.markets`.
      CollateralMock: getContract('CollateralMock'),
      Collateral2Mock: getContract('Collateral2Mock'),
      WstETHMock: getContract('WstETHMock'),
      StEthMock: getContract('StEthMock'),
      StEthToEthMock: getContract('StEthToEthMock'),
      SettlementHookMock: getContract('SettlementHookMock'),
      SettlementHook2Mock: getContract('SettlementHook2Mock'),
    };
  });

  const getOwner = () => getSigners()[0];
  const core = {
    provider: () => getProvider(),
    signers: () => getSigners(),
    owner: () => getOwner(),
    systems: () => systems,
    extras: () => getExtras(),
  };

  // Create a pool which makes `args.markets.length` with all equal weighting.
  const stakedPool = createStakedPool(core, args.pool.stakedCollateralPrice, args.pool.stakedAmount);

  // Configure spot market synths
  const _COLLATERALS_TO_CONFIGURE = [
    {
      name: 'swstETH',
      initialPrice: bn(genOneOf([1500, 1650, 1750, 1850, 4800])),
      max: bn(500_000),
      skewScale: bn(1_000_000),
    },
    {
      name: 'srETH',
      initialPrice: bn(genOneOf([1550, 1800, 2000, 2500])),
      max: bn(100_000),
      skewScale: bn(1_000_000),
    },
  ];
  const spotMarket = bootstrapSynthMarkets(
    _COLLATERALS_TO_CONFIGURE.map(({ initialPrice, name, skewScale }) => ({
      name,
      token: name,
      buyPrice: initialPrice,
      sellPrice: initialPrice,
      skewScale,
    })),
    stakedPool
  );

  before('wait for core bootstrap, pools, and synth markets...', async () => {
    await sleep(1000);
  });

  const getConfiguredSynths = () =>
    _COLLATERALS_TO_CONFIGURE.map((collateral, i) => ({ ...collateral, synthMarket: spotMarket.synthMarkets()[i] }));

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
      //
      // NOTE: For testing simplicity, every market's oracle node is a Chainlink aggregator.
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

  before('configure settlment hooks', async () => {
    const { PerpMarketProxy, SettlementHookMock, SettlementHook2Mock } = systems;
    await PerpMarketProxy.setSettlementHookConfiguration({
      whitelistedHookAddresses: [SettlementHookMock.address, SettlementHook2Mock.address],
      maxHooksPerOrder: args.global.hooks.maxHooksPerOrder,
    });
  });

  before(`delegate pool collateral to all markets equally`, async () => {
    // Spot market is configured incorrectly, only the last market gets delegated collateral.
    //
    // TODO: We should fix this in bootstrapSynthMarkets when merging into monorepo.
    //
    // TODO: For this perp market, we need 2 flavours.
    //
    // Flavour 1: One pool, multiple spot markets, multiple perp markets.
    // Flavour 2: One pool, one spot market (swsteth), one perp market (ethperp).
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

  let collaterals: PerpCollateral[];
  let collateralsWithoutSusd: PerpCollateral[];
  before('configure margin collaterals and their prices', async () => {
    const { Core, PerpMarketProxy } = systems;
    const synths = getConfiguredSynths();

    // Collaterals we want to configure for the perp market - prepended with sUSD configuration.
    const sUsdMaxDepositAllowance = bn(10_000_000);

    const synthMarketIds = [SYNTHETIX_USD_MARKET_ID];
    const maxAllowances = [sUsdMaxDepositAllowance];
    const oracleNodeIds = [utils.formatBytes32String('')];
    const rewardDistributors = [ADDRESS0];

    // Synth collaterals we previously created.
    for (const { synthMarket, max, name } of synths) {
      synthMarketIds.push(synthMarket.marketId());
      maxAllowances.push(max);
      oracleNodeIds.push(synthMarket.sellNodeId());

      // Create one RewardDistributor per collateral for distribution.
      const poolCollateralTypes = [stakedPool.collateralAddress()];
      const createArgs = {
        poolId: stakedPool.poolId,
        name: `${name} RewardDistributor`,
        token: synthMarket.synthAddress(),
        collateralTypes: [stakedPool.collateralAddress()],
      };

      const distributor = await PerpMarketProxy.connect(getOwner()).callStatic.createRewardDistributor(createArgs);
      await PerpMarketProxy.connect(getOwner()).createRewardDistributor(createArgs);

      // After creation, register the RewardDistributor with each pool collateral.
      for (const collateralType of poolCollateralTypes) {
        await Core.connect(getOwner()).registerRewardsDistributor(createArgs.poolId, collateralType, distributor);
      }
      rewardDistributors.push(distributor);
    }
    await PerpMarketProxy.connect(getOwner()).setMarginCollateralConfiguration(
      synthMarketIds,
      oracleNodeIds,
      maxAllowances,
      rewardDistributors
    );

    // Collect non-sUSD collaterals along with their Synth Market.
    const nonSusdCollaterals = synths.map((collateral, i): PerpCollateral => {
      const { synthMarket } = collateral;
      return {
        ...collateral,
        contract: synthMarket.synth(),
        synthMarketId: () => synthMarket.marketId(),
        synthAddress: () => synthMarket.synthAddress(),
        oracleNodeId: () => synthMarket.sellNodeId(),
        rewardDistributorAddress: () => rewardDistributors[i + 1],
        // Why `sellAggregator`? All of BFP only uses `quoteSellExactIn`, so we only need to mock the `sellAggregator`.
        // If we need to buy synths during tests and for whatever reason we cannot just mint with owner, then that can
        // still be referenced via `collateral.synthMarket.buyAggregator()`.
        //
        // @see: `spotMarket.contracts.storage.Price.getCurrentPriceData`
        getPrice: async () => (await synthMarket.sellAggregator().latestRoundData()).answer,
        // Why `setPrice`?
        //
        // If you only update the price of the sell aggregator, and try to close a losing position things might fail.
        // sellExactIn is called and will revert with Invalid prices, if they differ too much.
        // Adding a convenient method here to update the prices for both
        setPrice: async (price: BigNumber) => {
          await synthMarket.sellAggregator().mockSetCurrentPrice(price);
          await synthMarket.buyAggregator().mockSetCurrentPrice(price);
        },
      };
    });

    // Mock a sUSD synth collateral so it can also be used as a random collateral.
    //
    // NOTE: The system recognises sUSD as $1 so this sUsdAggregator is really just a stub but will never
    // be used in any capacity.
    const { aggregator: sUsdAggregator } = await createOracleNode(getOwner(), bn(1), systems.OracleManager);
    const sUsdCollateral: PerpCollateral = {
      name: 'sUSD',
      initialPrice: bn(1),
      max: sUsdMaxDepositAllowance,
      contract: systems.USD,
      synthMarketId: () => SYNTHETIX_USD_MARKET_ID,
      synthAddress: () => systems.USD.address,
      oracleNodeId: () => formatBytes32String(''),
      rewardDistributorAddress: () => rewardDistributors[0],
      getPrice: () => Promise.resolve(bn(1)),
      setPrice: async (price: BigNumber) => {
        await sUsdAggregator.mockSetCurrentPrice(price);
      },
    };

    const allCollaterals = [sUsdCollateral].concat(nonSusdCollaterals);

    // Ensure core system has enough capacity to deposit this collateral for perp market x.
    for (const collateral of allCollaterals) {
      for (const market of markets) {
        await systems.Core.connect(getOwner()).configureMaximumMarketCollateral(
          market.marketId(),
          collateral.synthAddress(),
          constants.MaxUint256
        );
      }
    }

    collaterals = allCollaterals;
    collateralsWithoutSusd = nonSusdCollaterals;
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
    // Here we reserve the signers [x, x, x, 3, 4, 5, 6, 7] as traders and the rest can be for other purposes.
    // a = owner
    // b = staker (see stakedPool)
    // c = spotMarktOwner (see bootstrapSynthMarkets)
    // 1 = trader
    // 2 = trader
    // 3 = trader
    // 4 = trader
    // 5 = trader
    // 6 = keeper (no funds)
    const [trader1, trader2, trader3, trader4, trader5, _keeper, _keeper2, _keeper3, _endorsedKeeper] =
      getSigners().slice(3);
    keeper = _keeper;
    keeper2 = _keeper2;
    keeper3 = _keeper3;
    endorsedKeeper = _endorsedKeeper;

    for (const [i, signer] of [trader1, trader2, trader3, trader4, trader5].entries()) {
      const accountId = i + 10;
      await PerpMarketProxy.connect(signer)['createAccount(uint128)'](accountId);

      traders.push({ signer, accountId });
    }
  });

  before(
    'reconfigure global market - keeper',
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
    collateralsWithoutSusd: () => collateralsWithoutSusd,
    pool: () => ({
      id: stakedPool.poolId,
      stakerAccountId: stakedPool.accountId,
      stakedAmount: stakedPool.depositAmount,
      staker: stakedPool.staker,
      collateral: stakedPool.collateralContract,
      oracleNodeId: stakedPool.oracleNodeId,
      aggregator: stakedPool.aggregator,
    }),
    spotMarket,
    ethOracleNode: () => ({ nodeId: ethOracleNodeId, agg: ethOracleAgg }),
  };
};
