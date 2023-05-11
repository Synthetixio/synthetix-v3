import { bootstrapWithStakedPool } from '@synthetixio/main/test/integration';
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
import { createOracleNode } from '@synthetixio/oracle-manager/test/integration/bootstrap';

export function bootstrapPerpsMarkets(
  data: Array<{ name: string; token: string; price: ethers.BigNumber }>,
  chainState?: ReturnType<typeof bootstrapWithStakedPool>
) {
  const r = chainState ?? bootstrapWithStakedPool(bootstrap(), bn(1000));
  let contracts: Systems, marketOwner: ethers.Signer;

  before('identify contracts', () => {
    contracts = r.systems() as Systems;
  });

  before('identify market owner', async () => {
    [, , marketOwner] = r.signers();
  });

  before('set snxUSD limit to max', async () => {
    // set max collateral amt for snxUSD to maxUINT
    await contracts.PerpsMarket.connect(r.owner()).setMaxCollateralAmount(
      0, // snxUSD
      ethers.constants.MaxUint256
    );
  });

  const perpsMarkets = data.map(({ name, token, price }) => {
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
}
