import { createStakedPool } from '@synthetixio/main/test/common';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { Systems, bootstrap, bn } from './bootstrap';
import { ethers } from 'ethers';
import { AggregatorV3Mock } from '@synthetixio/oracle-manager/typechain-types';
import { createOracleNode } from '@synthetixio/oracle-manager/test/common';
import { bootstrapSynthMarkets } from '@synthetixio/spot-market/test/common';

type PerpsMarkets = Array<{
  marketId: () => ethers.BigNumber;
  aggregator: () => AggregatorV3Mock;
}>;

export type PerpsMarketData = Array<{
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
    maintenanceMarginFraction: ethers.BigNumber;
    maxLiquidationLimitAccumulationMultiplier: ethers.BigNumber;
    liquidationRewardRatio: ethers.BigNumber;
  };
  maxMarketValue?: ethers.BigNumber;
  lockedOiPercent?: ethers.BigNumber;
}>;

type IncomingChainState =
  | ReturnType<typeof createStakedPool>
  | ReturnType<typeof bootstrapSynthMarkets>;

export const bootstrapPerpsMarkets = (
  data: PerpsMarketData,
  chainState: IncomingChainState | undefined
) => {
  const r: IncomingChainState = chainState ?? createStakedPool(bootstrap(), bn(1000));
  let contracts: Systems, marketOwner: ethers.Signer;

  before('identify contracts', () => {
    contracts = r.systems() as Systems;
  });

  before('identify market owner', async () => {
    [, , marketOwner] = r.signers();
  });

  const perpsMarkets: PerpsMarkets = data.map(
    ({
      name,
      token,
      price,
      orderFees,
      fundingParams,
      liquidationParams,
      maxMarketValue,
      lockedOiPercent,
    }) => {
      let oracleNodeId: string, aggregator: AggregatorV3Mock, marketId: ethers.BigNumber;
      before('create price nodes', async () => {
        const results = await createOracleNode(r.owner(), price, r.systems().OracleManager);
        oracleNodeId = results.oracleNodeId;
        aggregator = results.aggregator;
      });

      before(`create perps market ${name}`, async () => {
        marketId = await contracts.PerpsMarket.callStatic.createMarket(
          name,
          token,
          marketOwner.getAddress()
        );
        await contracts.PerpsMarket.createMarket(name, token, marketOwner.getAddress());
        await contracts.PerpsMarket.connect(marketOwner).updatePriceData(marketId, oracleNodeId);
      });

      before('delegate collateral from pool to market', async () => {
        await contracts.Core.connect(r.owner()).setPoolConfiguration(r.poolId, [
          {
            marketId,
            weightD18: ethers.utils.parseEther('1'),
            maxDebtShareValueD18: ethers.utils.parseEther('1'),
          },
        ]);
      });

      if (fundingParams) {
        before('set funding parameters', async () => {
          await contracts.PerpsMarket.connect(marketOwner).setFundingParameters(
            marketId,
            fundingParams.skewScale,
            fundingParams.maxFundingVelocity
          );
        });
      }

      if (orderFees) {
        before('set fees', async () => {
          await contracts.PerpsMarket.connect(marketOwner).setOrderFees(
            marketId,
            orderFees.makerFee,
            orderFees.takerFee
          );
        });
      }

      if (liquidationParams) {
        before('set liquidation parameters', async () => {
          await contracts.PerpsMarket.connect(marketOwner).setLiquidationParameters(
            marketId,
            liquidationParams.initialMarginFraction,
            liquidationParams.maintenanceMarginFraction,
            liquidationParams.liquidationRewardRatio,
            liquidationParams.maxLiquidationLimitAccumulationMultiplier
          );
        });
      }

      if (lockedOiPercent) {
        before('set locked oi percent', async () => {
          await contracts.PerpsMarket.connect(marketOwner).setLockedOiPercent(
            marketId,
            lockedOiPercent
          );
        });
      }

      if (maxMarketValue) {
        before('set max market value', async () => {
          await contracts.PerpsMarket.connect(marketOwner).setMaxMarketValue(
            marketId,
            maxMarketValue
          );
        });
      }

      return {
        marketId: () => marketId,
        aggregator: () => aggregator,
      };
    }
  );

  const restore = snapshotCheckpoint(r.provider);

  return {
    ...r,
    restore,
    systems: () => contracts,
    marketOwner: () => marketOwner,
    perpsMarkets: () => perpsMarkets,
    poolId: r.poolId,
  };
};
