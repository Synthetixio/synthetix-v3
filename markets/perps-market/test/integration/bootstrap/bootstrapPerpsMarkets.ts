import { createStakedPool } from '@synthetixio/main/test/common';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { Systems, bootstrap, bn } from './bootstrap';
import { ethers } from 'ethers';
import { AggregatorV3Mock } from '@synthetixio/oracle-manager/typechain-types';
import { createOracleNode } from '@synthetixio/oracle-manager/test/common';
import { bootstrapSynthMarkets } from '@synthetixio/spot-market/test/common';

export type PerpsMarket = {
  marketId: () => ethers.BigNumber;
  aggregator: () => AggregatorV3Mock;
  strategyId: () => ethers.BigNumber;
};

export type PerpsMarkets = Array<PerpsMarket>;

export type PerpsMarketData = Array<{
  requestedMarketId: ethers.BigNumber | number;
  name: string;
  token: string;
  price: ethers.BigNumber;
  orderFees?: {
    makerFee: ethers.BigNumber;
    takerFee: ethers.BigNumber;
  };
  fundingParams?: {
    skewScale: ethers.BigNumber;
    maxFundingVelocity: ethers.BigNumber;
  };
  liquidationParams?: {
    initialMarginFraction: ethers.BigNumber;
    minimumInitialMarginRatio: ethers.BigNumber;
    maintenanceMarginScalar: ethers.BigNumber;
    maxLiquidationLimitAccumulationMultiplier: ethers.BigNumber;
    liquidationRewardRatio: ethers.BigNumber;
    maxSecondsInLiquidationWindow: ethers.BigNumber;
    minimumPositionMargin: ethers.BigNumber;
    maxLiquidationPd?: ethers.BigNumber;
    endorsedLiquidator?: string;
  };
  maxMarketValue?: ethers.BigNumber;
  lockedOiRatioD18?: ethers.BigNumber;
  settlementStrategy?: Partial<{
    strategyType: ethers.BigNumber;
    settlementDelay: ethers.BigNumber;
    settlementWindowDuration: ethers.BigNumber;
    priceWindowDuration: ethers.BigNumber;
    feedId: string;
    url: string;
    settlementReward: ethers.BigNumber;
    priceDeviationTolerance: ethers.BigNumber;
    disabled: boolean;
  }>;
}>;

type IncomingChainState =
  | ReturnType<typeof createStakedPool>
  | ReturnType<typeof bootstrapSynthMarkets>;

export const DEFAULT_SETTLEMENT_STRATEGY = {
  strategyType: 0, // OFFCHAIN
  settlementDelay: 5,
  settlementWindowDuration: 120,
  priceWindowDuration: 110,
  settlementReward: bn(5),
  priceDeviationTolerance: bn(0.01),
  disabled: false,
  url: 'https://fakeapi.pyth.synthetix.io/',
  feedId: ethers.utils.formatBytes32String('ETH/USD'),
};

export const bootstrapPerpsMarkets = (
  data: PerpsMarketData,
  chainState: IncomingChainState | undefined
) => {
  const r: IncomingChainState = chainState ?? createStakedPool(bootstrap(), bn(2000));
  let contracts: Systems, superMarketId: ethers.BigNumber;

  before('identify contracts', () => {
    contracts = r.systems() as Systems;
  });

  before('create super market', async () => {
    superMarketId = await contracts.PerpsMarket.callStatic.initializeFactory();
    await contracts.PerpsMarket.initializeFactory();

    await contracts.Core.connect(r.owner()).setPoolConfiguration(r.poolId, [
      {
        marketId: superMarketId,
        weightD18: ethers.utils.parseEther('1'),
        maxDebtShareValueD18: ethers.utils.parseEther('1'),
      },
    ]);
  });

  const perpsMarkets: PerpsMarkets = data.map(
    ({
      requestedMarketId: marketId,
      name,
      token,
      price,
      orderFees,
      fundingParams,
      liquidationParams,
      maxMarketValue,
      lockedOiRatioD18,
      settlementStrategy,
    }) => {
      let oracleNodeId: string, aggregator: AggregatorV3Mock;
      before('create price nodes', async () => {
        const results = await createOracleNode(r.owner(), price, r.systems().OracleManager);
        oracleNodeId = results.oracleNodeId;
        aggregator = results.aggregator;
      });

      before(`create perps market ${name}`, async () => {
        await contracts.PerpsMarket.createMarket(marketId, name, token);
        await contracts.PerpsMarket.connect(r.owner()).updatePriceData(marketId, oracleNodeId);
      });

      before('set funding parameters', async () => {
        await contracts.PerpsMarket.connect(r.owner()).setFundingParameters(
          marketId,
          fundingParams ? fundingParams.skewScale : bn(1_000_000),
          fundingParams ? fundingParams.maxFundingVelocity : 0
        );
      });

      before('set max market value', async () => {
        await contracts.PerpsMarket.connect(r.owner()).setMaxMarketSize(
          marketId,
          maxMarketValue ? maxMarketValue : bn(10_000_000)
        );
      });

      if (orderFees) {
        before('set fees', async () => {
          await contracts.PerpsMarket.connect(r.owner()).setOrderFees(
            marketId,
            orderFees.makerFee,
            orderFees.takerFee
          );
        });
      }

      if (liquidationParams) {
        before('set liquidation parameters', async () => {
          await contracts.PerpsMarket.connect(r.owner()).setLiquidationParameters(
            marketId,
            liquidationParams.initialMarginFraction,
            liquidationParams.minimumInitialMarginRatio,
            liquidationParams.maintenanceMarginScalar,
            liquidationParams.liquidationRewardRatio,
            liquidationParams.minimumPositionMargin
          );

          await contracts.PerpsMarket.connect(r.owner()).setMaxLiquidationParameters(
            marketId,
            liquidationParams.maxLiquidationLimitAccumulationMultiplier,
            liquidationParams.maxSecondsInLiquidationWindow,
            liquidationParams.maxLiquidationPd ?? 0,
            liquidationParams.endorsedLiquidator ?? ethers.constants.AddressZero
          );
        });
      }

      if (lockedOiRatioD18) {
        before('set locked oi percent', async () => {
          await contracts.PerpsMarket.connect(r.owner()).setLockedOiRatio(
            marketId,
            lockedOiRatioD18
          );
        });
      }

      let strategyId: ethers.BigNumber;
      // create default settlement strategy
      before('create default settlement strategy', async () => {
        const strategy = {
          ...DEFAULT_SETTLEMENT_STRATEGY,
          ...(settlementStrategy ?? {}),
          priceVerificationContract: contracts.MockPyth.address,
        };
        // first call is static to get strategyId
        strategyId = await contracts.PerpsMarket.connect(
          r.owner()
        ).callStatic.addSettlementStrategy(marketId, strategy);

        await contracts.PerpsMarket.connect(r.owner()).addSettlementStrategy(marketId, strategy);
      });

      return {
        marketId: () => (isNumber(marketId) ? ethers.BigNumber.from(marketId) : marketId),
        aggregator: () => aggregator,
        strategyId: () => strategyId,
      };
    }
  );

  const restore = snapshotCheckpoint(r.provider);

  return {
    ...r,
    restore,
    superMarketId: () => superMarketId,
    systems: () => contracts,
    perpsMarkets: () => perpsMarkets,
    poolId: r.poolId,
  };
};

const isNumber = (n: ethers.BigNumber | number): n is number => typeof n === 'number' && !isNaN(n);
