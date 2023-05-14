import { createStakedPool } from '@synthetixio/main/test/common';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { Systems, bootstrap, bn } from './bootstrap';
import { ethers } from 'ethers';
import {
  SpotMarketSpotMarketProxy,
  SynthetixCollateralMock,
  SynthetixCoreProxy,
  SynthetixOracle_managerProxy,
  SynthetixUSDProxy,
  PerpsMarketProxy,
  AccountProxy,
} from '../../generated/typechain';
import { AggregatorV3Mock } from '@synthetixio/oracle-manager/typechain-types';
import { createOracleNode } from '@synthetixio/oracle-manager/test/common';
import { bootstrapSynthMarkets } from '@synthetixio/spot-market/test/common';

type PerpsMarkets = Array<{
  marketId: () => ethers.BigNumber;
  aggregator: () => AggregatorV3Mock;
}>;

export type PerpsMarketData = Array<{ name: string; token: string; price: ethers.BigNumber }>;

type IncomingChainState =
  | ReturnType<typeof createStakedPool>
  | ReturnType<typeof bootstrapSynthMarkets>;
type NewChainState = {
  systems: () => Systems;
  perpsMarkets: () => PerpsMarkets;
  restore: () => Promise<void>;
};
type PerpsMarketsReturn<T> = T extends undefined
  ? NewChainState & IncomingChainState
  : NewChainState;

type BootstrapPerpsMarketType = <T extends IncomingChainState | undefined>(
  data: PerpsMarketData,
  chainState: T
) => PerpsMarketsReturn<T>;

export const bootstrapPerpsMarkets: BootstrapPerpsMarketType = (data, chainState) => {
  const r: IncomingChainState = chainState ?? createStakedPool(bootstrap(), bn(1000));
  let contracts: Systems, marketOwner: ethers.Signer;

  before('identify contracts', () => {
    contracts = r.systems() as Systems;
  });

  before('identify market owner', async () => {
    [, , marketOwner] = r.signers();
  });

  const perpsMarkets: PerpsMarkets = data.map(({ name, token, price }) => {
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

    return {
      marketId: () => marketId,
      aggregator: () => aggregator,
    };
  });

  const restore = snapshotCheckpoint(r.provider);

  return {
    ...r,
    restore,
    systems: () => contracts,
    perpsMarkets: () => perpsMarkets,
  };
};
