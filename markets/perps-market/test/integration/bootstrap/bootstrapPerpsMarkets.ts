import { createStakedPool } from '@synthetixio/main/test/common';
import { Systems, bootstrap, bn } from './bootstrap';
import { ethers } from 'ethers';
import { MockPythExternalNode } from '@synthetixio/oracle-manager/typechain-types';
import { createPythNode } from '@synthetixio/oracle-manager/test/common';
import { bootstrapSynthMarkets } from '@synthetixio/spot-market/test/common';

export type PerpsMarket = {
  marketId: () => ethers.BigNumber;
  aggregator: () => MockPythExternalNode;
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
  maxMarketSize?: ethers.BigNumber;
  maxMarketValue?: ethers.BigNumber;
  lockedOiRatioD18?: ethers.BigNumber;
  settlementStrategy?: Partial<{
    strategyType: ethers.BigNumber;
    commitmentPriceDelay: ethers.BigNumber;
    settlementDelay: ethers.BigNumber;
    settlementWindowDuration: ethers.BigNumber;
    feedId: string;
    url: string;
    settlementReward: ethers.BigNumber;
    disabled: boolean;
  }>;
}>;

type IncomingChainState =
  | ReturnType<typeof createStakedPool>
  | ReturnType<typeof bootstrapSynthMarkets>;

export const DEFAULT_SETTLEMENT_STRATEGY = {
  strategyType: 0, // OFFCHAIN
  settlementDelay: 5,
  commitmentPriceDelay: 2,
  settlementWindowDuration: 120,
  settlementReward: bn(5),
  disabled: false,
  url: 'https://fakeapi.pyth.synthetix.io/',
  feedId: ethers.utils.formatBytes32String('ETH/USD'),
};

export const STRICT_PRICE_TOLERANCE = ethers.BigNumber.from(60);

export const bootstrapPerpsMarkets = (
  data: PerpsMarketData,
  chainState: IncomingChainState | undefined
) => {
  const r: IncomingChainState = chainState ?? createStakedPool(bootstrap(), bn(2000));

  let contracts: Systems;
  let superMarketId: ethers.BigNumber;
  let perpsMarkets: PerpsMarkets;

  before(async () => {
    // identify contracts
    contracts = r.systems() as Systems;

    // create super market
    superMarketId = await contracts.PerpsMarket.callStatic.initializeFactory(
      contracts.Core.address,
      contracts.SpotMarket.address
    );
    await contracts.PerpsMarket.initializeFactory(
      contracts.Core.address,
      contracts.SpotMarket.address
    );

    await contracts.PerpsMarket.connect(r.owner()).setPerpsMarketName('SuperMarket');
    await contracts.Core.connect(r.owner()).setPoolConfiguration(r.poolId, [
      {
        marketId: superMarketId,
        weightD18: ethers.utils.parseEther('1'),
        maxDebtShareValueD18: ethers.utils.parseEther('1'),
      },
    ]);

    // Create perps markets
    perpsMarkets = [];

    for await (const item of data) {
      const {
        requestedMarketId: marketId,
        name,
        token,
        price,
        orderFees,
        fundingParams,
        liquidationParams,
        maxMarketSize,
        maxMarketValue,
        lockedOiRatioD18,
        settlementStrategy,
      } = item;

      // create perps price nodes
      const results = await createPythNode(r.owner(), price, contracts.OracleManager);
      const aggregator: MockPythExternalNode = results.aggregator;

      // create perps market
      await contracts.PerpsMarket.createMarket(marketId, name, token);
      await contracts.PerpsMarket.connect(r.owner()).updatePriceData(
        marketId,
        results.oracleNodeId,
        STRICT_PRICE_TOLERANCE
      );

      // set funding parameters
      await contracts.PerpsMarket.connect(r.owner()).setFundingParameters(
        marketId,
        fundingParams ? fundingParams.skewScale : bn(1_000_000),
        fundingParams ? fundingParams.maxFundingVelocity : 0
      );

      // set max market value
      await contracts.PerpsMarket.connect(r.owner()).setMaxMarketSize(
        marketId,
        maxMarketSize ? maxMarketSize : bn(10_000_000)
      );
      await contracts.PerpsMarket.connect(r.owner()).setMaxMarketValue(
        marketId,
        maxMarketValue ? maxMarketValue : 0
      );

      // set fees
      if (orderFees) {
        await contracts.PerpsMarket.connect(r.owner()).setOrderFees(
          marketId,
          orderFees.makerFee,
          orderFees.takerFee
        );
      }

      if (liquidationParams) {
        // 'set liquidation parameters
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
      }

      if (lockedOiRatioD18) {
        // set locked oi percent
        await contracts.PerpsMarket.connect(r.owner()).setLockedOiRatio(marketId, lockedOiRatioD18);
      }

      // create default settlement strategy
      const strategy = {
        ...DEFAULT_SETTLEMENT_STRATEGY,
        ...(settlementStrategy ?? {}),
        priceVerificationContract: contracts.MockPythERC7412Wrapper.address,
      };

      // the first call is static to get strategyId
      const strategyId: ethers.BigNumber = await contracts.PerpsMarket.connect(
        r.owner()
      ).callStatic.addSettlementStrategy(marketId, strategy);

      await contracts.PerpsMarket.connect(r.owner()).addSettlementStrategy(marketId, strategy);

      perpsMarkets.push({
        marketId: () => (isNumber(marketId) ? ethers.BigNumber.from(marketId) : marketId),
        aggregator: () => aggregator,
        strategyId: () => strategyId,
      });
    }
  });

  return {
    ...r,
    superMarketId: () => superMarketId,
    systems: () => contracts,
    perpsMarkets: () => perpsMarkets,
    poolId: r.poolId,
    collateralAddress: r.collateralAddress,
  };
};

const isNumber = (n: ethers.BigNumber | number): n is number => typeof n === 'number' && !isNaN(n);
