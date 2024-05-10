import { BigNumber, utils, Signer, constants } from 'ethers';
import { coreBootstrap } from '@synthetixio/router/utils/tests';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { createStakedPool } from '@synthetixio/main/test/common';
import { createOracleNode } from '@synthetixio/oracle-manager/test/common';
import { BfpMarketProxy, PerpAccountProxy } from './generated/typechain';
import {
  CollateralMock,
  SettlementHookMock,
  AggregatorV3Mock,
  MergeAccountSettlementHookMock,
} from '../typechain-types';
import { bn, genOneOf } from './generators';
import { ADDRESS0 } from './helpers';
import { formatBytes32String } from 'ethers/lib/utils';
import { GeneratedBootstrap } from './typed';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PythMock = any; // Cannon imported modules don't generate types via typechain...

// A set of available contracts during testing. We extend that which is already available through
// `createStakePool` and we add more bfp-market specific contracts.
interface Systems extends ReturnType<Parameters<typeof createStakedPool>[0]['systems']> {
  BfpMarketProxy: BfpMarketProxy;
  PythMock: PythMock;
  CollateralMockD18: CollateralMock;
  CollateralMockD8: CollateralMock;
  SettlementHookMock: SettlementHookMock;
  SettlementHook2Mock: SettlementHookMock;
  MergeAccountSettlementHookMock: MergeAccountSettlementHookMock;
  Account: PerpAccountProxy;
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
  ['pyth.Pyth']: PythMock;
  CollateralMock: CollateralMock;
  Collateral2Mock: CollateralMock;
  CollateralMockD18: CollateralMock;
  CollateralMockD8: CollateralMock;
  BfpMarketProxy: BfpMarketProxy;
  PerpAccountProxy: PerpAccountProxy;
  SettlementHookMock: SettlementHookMock;
  SettlementHook2Mock: SettlementHookMock;
  MergeAccountSettlementHookMock: MergeAccountSettlementHookMock;
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
const _bootstraped = coreBootstrap<Contracts>({ cannonfile: 'cannonfile.test.toml' });
const restoreSnapshot = _bootstraped.createSnapshot();

export interface PerpCollateral {
  name: string;
  initialPrice: BigNumber;
  max: BigNumber;
  contract: Systems['USD'] | CollateralMock;
  address: () => string;
  oracleNodeId: () => string;
  rewardDistributorAddress: () => string;
  skewScale: () => BigNumber;
  getPrice: () => Promise<BigNumber>;
  setPrice: (price: BigNumber) => Promise<void>;
}

// Configure collaterals in bfp-market.
const MARGIN_COLLATERALS_TO_CONFIGURE = [
  {
    name: 'wstETH',
    initialPrice: bn(genOneOf([1500, 1650, 1750, 1850, 4800])),
    max: bn(500_000),
    skewScale: bn(1_000_000),
    contractName: 'CollateralMock',
  },
  {
    name: 'wETH',
    initialPrice: bn(genOneOf([1550, 1800, 2000, 2500])),
    max: bn(100_000),
    skewScale: bn(1_000_000),
    contractName: 'Collateral2Mock',
  },
] as const;

export const bootstrap = (args: GeneratedBootstrap) => {
  const { getContract, getSigners, getExtras, getProvider } = _bootstraped;

  before(restoreSnapshot);

  let systems: Systems;

  const getOwner = () => getSigners()[0];
  const core = {
    provider: () => getProvider(),
    signers: () => getSigners(),
    owner: () => getOwner(),
    systems: () => systems,
    extras: () => getExtras(),
  };

  before('load core and perp contracts', () => {
    systems = {
      Account: getContract('PerpAccountProxy'),
      BfpMarketProxy: getContract('BfpMarketProxy'),
      Core: getContract('synthetix.CoreProxy'),
      USD: getContract('synthetix.USDProxy'),
      OracleManager: getContract('synthetix.oracle_manager.Proxy'),
      PythMock: getContract('pyth.Pyth'),
      // CollateralMock and Collateral2Mock are contracts needed by bootstraps invoked before this boostrap.
      CollateralMock: getContract('CollateralMock'),
      Collateral2Mock: getContract('Collateral2Mock'),
      CollateralMockD18: getContract('CollateralMockD18'),
      CollateralMockD8: getContract('CollateralMockD8'),
      SettlementHookMock: getContract('SettlementHookMock'),
      SettlementHook2Mock: getContract('SettlementHook2Mock'),
      MergeAccountSettlementHookMock: getContract('MergeAccountSettlementHookMock'),
    };
  });

  // Create a pool which makes `args.markets.length` with all equal weighting.
  const stakedPool = createStakedPool(
    core,
    args.pool.stakedCollateralPrice,
    args.pool.stakedAmount
  );

  let ethOracleNodeId: string;
  let ethOracleAgg: AggregatorV3Mock;

  const markets: {
    oracleNodeId: () => string;
    aggregator: () => AggregatorV3Mock;
    marketId: () => BigNumber;
  }[] = [];

  let collaterals: PerpCollateral[];
  let collateralsWithoutSusd: PerpCollateral[];

  let keeper: Signer;
  let keeper2: Signer;
  let keeper3: Signer;
  let endorsedKeeper: Signer;
  const traders: { signer: Signer; accountId: number }[] = [];

  before('perp market bootstrap', async () => {
    const {
      Core,
      BfpMarketProxy,
      SettlementHookMock,
      SettlementHook2Mock,
      MergeAccountSettlementHookMock,
      OracleManager,
      USD,
    } = systems;

    // Configure global markets.
    await BfpMarketProxy.connect(getOwner()).setMarketConfiguration(args.global);

    // Configure ETH/USD price oracle node.
    const { oracleNodeId, aggregator } = await createOracleNode(
      getOwner(),
      args.initialEthPrice,
      OracleManager
    );
    await BfpMarketProxy.connect(getOwner()).setEthOracleNodeId(oracleNodeId);

    ethOracleNodeId = oracleNodeId;
    ethOracleAgg = aggregator;

    // Configure markets and their nodes.
    for (const market of args.markets) {
      const { name, initialPrice, specific } = market;

      // The market has its own price e.g. ETH/USD. This oracle node is for that.
      //
      // NOTE: For testing simplicity, every market's oracle node is a Chainlink aggregator.
      const { oracleNodeId, aggregator } = await createOracleNode(
        getOwner(),
        initialPrice,
        OracleManager
      );

      // Create market.
      const marketId = await BfpMarketProxy.callStatic.createMarket({ name });
      await BfpMarketProxy.createMarket({ name });

      // Configure market.
      await BfpMarketProxy.connect(getOwner()).setMarketConfigurationById(marketId, {
        ...specific,
        // Override the generic supplied oracleNodeId with the one that was just created.
        oracleNodeId,
      });
      markets.push({
        oracleNodeId: () => oracleNodeId,
        aggregator: () => aggregator,
        marketId: () => marketId,
      });
    }

    // Configure settlement hooks.
    await BfpMarketProxy.setSettlementHookConfiguration({
      whitelistedHookAddresses: [
        SettlementHookMock.address,
        SettlementHook2Mock.address,
        MergeAccountSettlementHookMock.address,
      ],
      maxHooksPerOrder: args.global.hooks.maxHooksPerOrder,
    });

    const perpMarketPoolConfig = markets.map(({ marketId }) => ({
      marketId: marketId(),
      weightD18: utils.parseEther('1'),
      maxDebtShareValueD18: utils.parseEther('1'),
    }));
    await Core.connect(getOwner()).setPoolConfiguration(stakedPool.poolId, perpMarketPoolConfig);

    // Collaterals we want to configure for the perp market - prepended with sUSD configuration.
    const sUsdMaxDepositAllowance = bn(10_000_000);
    const sUSDSkewScale = bn(1_000_000);
    const sUSD = USD.address;
    const collateralAddresses = [sUSD];
    const maxAllowances = [sUsdMaxDepositAllowance];
    const skewScales = [sUSDSkewScale];
    // Mock a sUSD synth collateral so it can also be used as a random collateral.
    //
    // NOTE: The system recognises sUSD as $1 so this sUsdAggregator is really just a stub but will never
    // be used in any capacity.
    const { aggregator: sUsdAggregator } = await createOracleNode(getOwner(), bn(1), OracleManager);
    const aggregators = [sUsdAggregator];
    const oracleNodeIds = [utils.formatBytes32String('')];
    const rewardDistributors = [ADDRESS0];
    const contracts: (CollateralMock | Systems['USD'])[] = [systems.USD];

    // Synth collaterals we previously created.
    for (const {
      max,
      name,
      contractName,
      initialPrice,
      skewScale,
    } of MARGIN_COLLATERALS_TO_CONFIGURE) {
      const collateral = getContract(contractName);
      contracts.push(collateral);
      collateralAddresses.push(collateral.address);
      maxAllowances.push(max);

      const { oracleNodeId, aggregator } = await createOracleNode(
        getOwner(),
        initialPrice,
        OracleManager
      );
      // Make sure all our collateral is enabled in core
      await Core.connect(getOwner()).configureCollateral({
        tokenAddress: collateral.address,
        oracleNodeId,
        issuanceRatioD18: '5000000000000000000',
        liquidationRatioD18: '1500000000000000000',
        liquidationRewardD18: '20000000000000000000',
        minDelegationD18: '20000000000000000000',
        depositingEnabled: true,
      });
      aggregators.push(aggregator);
      oracleNodeIds.push(oracleNodeId);
      skewScales.push(skewScale);
      // Create one RewardDistributor per collateral for distribution.
      const poolCollateralTypes = [stakedPool.collateralAddress()];
      const createArgs = {
        poolId: stakedPool.poolId,
        name: `${name} RewardDistributor`,
        token: collateral.address,
        collateralTypes: [stakedPool.collateralAddress()],
      };

      const distributor =
        await BfpMarketProxy.connect(getOwner()).callStatic.createRewardDistributor(createArgs);
      await BfpMarketProxy.connect(getOwner()).createRewardDistributor(createArgs);

      // After creation, register the RewardDistributor with each pool collateral.
      for (const collateralType of poolCollateralTypes) {
        await Core.connect(getOwner()).registerRewardsDistributor(
          createArgs.poolId,
          collateralType,
          distributor
        );
      }
      rewardDistributors.push(distributor);
    }

    await BfpMarketProxy.connect(getOwner()).setMarginCollateralConfiguration(
      collateralAddresses,
      oracleNodeIds,
      maxAllowances,
      skewScales,
      rewardDistributors
    );

    // Collect non-sUSD collaterals along with their Synth Market.
    const nonSusdCollaterals = MARGIN_COLLATERALS_TO_CONFIGURE.map(
      (collateral, i): PerpCollateral => {
        return {
          ...collateral,
          skewScale: () => skewScales[i + 1],
          contract: contracts[i + 1],
          address: () => contracts[i + 1].address,
          oracleNodeId: () => oracleNodeIds[i + 1],
          rewardDistributorAddress: () => rewardDistributors[i + 1],
          getPrice: async () => aggregators[i + 1].latestRoundData().then((x) => x.answer),
          setPrice: async (price: BigNumber) => {
            await aggregators[i + 1].mockSetCurrentPrice(price);
          },
        };
      }
    );

    const sUsdCollateral: PerpCollateral = {
      name: 'sUSD',
      initialPrice: bn(1),
      max: sUsdMaxDepositAllowance,
      contract: USD,
      skewScale: () => sUSDSkewScale,
      address: () => USD.address,
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
        await Core.connect(getOwner()).configureMaximumMarketCollateral(
          market.marketId(),
          collateral.address(),
          constants.MaxUint256
        );
      }
    }

    collaterals = allCollaterals;
    collateralsWithoutSusd = nonSusdCollaterals;

    // Configure keepers and traders.

    // `getSigners()` returns a static amount of signers you can test with. The signer at idx=0 is
    // always reserved as the owner but everything else is free game.
    //
    // Here we reserve the signers [x, x, x, 3, 4, 5, 6, 7] as traders and the rest can be for other purposes.
    // a = owner
    // b = staker (see stakedPool)
    // c = unused
    // 1 = trader
    // 2 = trader
    // 3 = trader
    // 4 = trader
    // 5 = trader
    // 6 = keeper (no funds)
    const [
      trader1,
      trader2,
      trader3,
      trader4,
      trader5,
      _keeper,
      _keeper2,
      _keeper3,
      _endorsedKeeper,
    ] = getSigners().slice(3);
    keeper = _keeper;
    keeper2 = _keeper2;
    keeper3 = _keeper3;
    endorsedKeeper = _endorsedKeeper;

    for (const [i, signer] of [trader1, trader2, trader3, trader4, trader5].entries()) {
      const accountId = i + 10;
      await BfpMarketProxy.connect(signer)['createAccount(uint128)'](accountId);

      traders.push({ signer, accountId });
    }

    // Reconfigure global market - keeper
    await BfpMarketProxy.connect(getOwner()).setMarketConfiguration({
      ...args.global,
      // Replace the mocked endorsedKeeper with a real designated endorsed keeper.
      keeperLiquidationEndorsed: await endorsedKeeper.getAddress(),
    });
  });

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
    ethOracleNode: () => ({ nodeId: ethOracleNodeId, agg: ethOracleAgg }),
  };
};
