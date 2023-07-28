import { coreBootstrap } from '@synthetixio/router/dist/utils/tests';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { createStakedPool } from '@synthetixio/main/test/common';
import {
  PerpMarketProxy,
  AccountProxy,
  SnxV3CollateralMock,
  SynthetixUsdXCollateralMock,
  WrappedStakedEthCollateralMock,
  PythMock,
  AggregatorV3Mock,
} from './generated/typechain';
import type { IMarketConfigurationModule } from './generated/typechain/MarketConfigurationModule';
import { BigNumber, utils, Signer, constants } from 'ethers';
import { createOracleNode } from '@synthetixio/oracle-manager/test/common';
import { CollateralMock } from '../typechain-types';
import { bn, genInt } from './generators';

interface Systems extends ReturnType<Parameters<typeof createStakedPool>[0]['systems']> {
  PerpMarketProxy: PerpMarketProxy;
  AggregatorV3Mock: AggregatorV3Mock;
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
export interface Contracts {
  ['synthetix.CoreProxy']: Systems['Core'];
  ['synthetix.USDProxy']: Systems['USD'];
  ['synthetix.oracle_manager.Proxy']: Systems['OracleManager'];
  SnxV3CollateralMock: SnxV3CollateralMock;
  SynthetixUsdXCollateralMock: SynthetixUsdXCollateralMock;
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
  pool: {
    initialCollateralPrice: BigNumber;
  };
  global: IMarketConfigurationModule.ConfigureParametersStruct;
  markets: {
    name: string;
    initialPrice: BigNumber;
    specific: IMarketConfigurationModule.ConfigureByMarketParametersStruct;
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
      AggregatorV3Mock: getContract('AggregatorV3Mock'),
      PythMock: getContract('PythMock'),
      // Difference between this and `Collateral{2}Mock`?
      //
      // `Collateral{2}Mock` is defined by a `cannon.test.toml` which isn't available here. Both mocks below
      // follow the same ERC20 standard, simply named differently.
      //
      // `CollateralMock` is collateral deposited/delegated configured `args.markets`.
      CollateralMock: getContract('SnxV3CollateralMock'),
      Collateral2Mock: getContract('WrappedStakedEthCollateralMock'),
      Collateral3Mock: getContract('SynthetixUsdXCollateralMock'),
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
  const stakedPool = createStakedPool(core, args.pool.initialCollateralPrice);

  before('configure global market', async () => {
    const tx = await systems.PerpMarketProxy.connect(getOwner()).setMarketConfiguration(args.global);
    await tx.wait();
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
      const tx = await systems.PerpMarketProxy.createMarket({ name });
      await tx.wait();
    });

    before(`delegate pool collateral to market - ${name}`, async () => {
      const tx = await systems.Core.connect(getOwner()).setPoolConfiguration(stakedPool.poolId, [
        {
          marketId,
          weightD18: utils.parseEther('1'),
          maxDebtShareValueD18: utils.parseEther('1'),
        },
      ]);
      await tx.wait();
    });

    before(`configure market - ${readableName}`, async () => {
      const tx = await systems.PerpMarketProxy.connect(getOwner()).setMarketConfigurationById(marketId, {
        ...specific,
        // Override the generic supplied oracleNodeId with the one that was just created.
        oracleNodeId,
      });
      await tx.wait();
    });

    return {
      oracleNodeId: () => oracleNodeId,
      aggregator: () => aggregator,
      marketId: () => marketId,
    };
  });

  // Overall market allows up to n collaterals, each having their own oracle node.
  const configureCollateral = async () => {
    const collaterals = [
      { contract: systems.CollateralMock, initialPrice: bn(genInt(25, 100)), max: bn(10_000_000) },
      { contract: systems.Collateral2Mock, initialPrice: bn(genInt(1, 10)), max: bn(999_999) },
      { contract: systems.Collateral3Mock, initialPrice: bn(genInt(1000, 5000)), max: bn(100_000) },
    ];
    const collateralTypes = collaterals.map(({ contract }) => contract.address);
    const owner = getOwner();

    let collateralOracles: Awaited<ReturnType<typeof createOracleNode>>[] = [];
    for (const { initialPrice, contract } of collaterals) {
      // Update core system to allow this collateral to be deposited for all provisioned markets.
      for (const market of markets) {
        // Ensure core system recognises this collateral.
        let tx = await systems.Core.connect(owner).configureCollateral({
          tokenAddress: contract.address,
          oracleNodeId: market.oracleNodeId(),
          issuanceRatioD18: bn(1),
          liquidationRatioD18: bn(1),
          liquidationRewardD18: bn(1),
          minDelegationD18: bn(1),
          depositingEnabled: true,
        });
        await tx.wait();

        // Ensure core system has enough capacity to deposit this collateral for market x.
        tx = await systems.Core.connect(owner).configureMaximumMarketCollateral(
          market.marketId(),
          contract.address,
          constants.MaxUint256
        );
        await tx.wait();
      }

      collateralOracles.push(await createOracleNode(owner, initialPrice, systems.OracleManager));
    }

    const oracleNodeIds = collateralOracles.map(({ oracleNodeId }) => oracleNodeId);
    const maxAllowables = collaterals.map(({ max }) => max);

    // Allow this collateral to be depositable into the perp market.
    const tx = await systems.PerpMarketProxy.connect(getOwner()).setCollateralConfiguration(
      collateralTypes,
      oracleNodeIds,
      maxAllowables
    );
    await tx.wait();

    return collaterals.map((collateral, idx) => ({
      ...collateral,
      oracleNodeId: () => oracleNodeIds[idx],
      aggregator: () => collateralOracles[idx].aggregator,
    }));
  };
  let collaterals: Awaited<ReturnType<typeof configureCollateral>>;

  before('configure collaterals and their prices', async () => {
    collaterals = await configureCollateral();
  });

  let keeper: Signer;
  const traders: { signer: Signer; accountId: number }[] = [];
  before('configure traders', async () => {
    const { PerpMarketProxy } = systems;
    // `getSigners()` returns a static amount of signers you can test with. The signer at idx=0 is
    // always reserved as the owner but everything else is free game.
    //
    // Here we reserve the [1, 2, 3, 4] as traders and the rest can be for other purposes.
    //
    // 1 = trader
    // 2 = trader
    // 3 = trader
    // 4 = keeper (no funds)
    const [trader1, trader2, trader3, _keeper] = getSigners().slice(1);
    keeper = _keeper;

    const owner = getOwner();
    const createAccountFeature = utils.formatBytes32String('createAccount');
    for (const [i, signer] of [trader1, trader2, trader3].entries()) {
      const address = await signer.getAddress();

      // The Synthetix AccountModule has a feature flag that currently prevents anyone from creating an account.
      await PerpMarketProxy.connect(owner).addToFeatureFlagAllowlist(createAccountFeature, address);

      const accountId = i + 10;
      await PerpMarketProxy.connect(signer)['createAccount(uint128)'](accountId);

      traders.push({ signer, accountId });
    }
  });

  const restore = snapshotCheckpoint(core.provider);

  return {
    ...core,
    traders: () => traders,
    keeper: () => keeper,
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
  };
};
