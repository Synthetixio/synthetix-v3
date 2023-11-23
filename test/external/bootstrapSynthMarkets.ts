// --- WARNING: COPIED WITH MINOR ADJUSTMENTS FROM SPOT MARKET --- //
//
// A copy was necessary for two reasons (1) the original version does not expose the
// `{buy,sell}NodeId` which is needed to configure collaterals in perps. There are no views
// in the spot-market to allow for a oracle node id to be fetched either. The (2) reason is
// this will eventually be ported over to bfp-market to support differing flavours of spot
// markets for a realistic configuration of an l1 perp.
//
// --- END WARNING ---

import { ethers } from 'ethers';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { createStakedPool } from '@synthetixio/main/test/common';
import { createOracleNode } from '@synthetixio/oracle-manager/test/common';
import { AggregatorV3Mock } from '@synthetixio/spot-market/typechain-types';
import { SynthRouter } from '@synthetixio/spot-market/test/generated/typechain';
import { Systems } from '@synthetixio/spot-market/test/bootstrap';

export type SynthMarket = {
  marketId: () => ethers.BigNumber;
  buyAggregator: () => AggregatorV3Mock;
  buyNodeId: () => string;
  sellAggregator: () => AggregatorV3Mock;
  sellNodeId: () => string;
  synth: () => SynthRouter;
  synthAddress: () => string;
};

export type BootstrapSynthArgs = {
  name: string;
  token: string;
  buyPrice: ethers.BigNumber;
  sellPrice: ethers.BigNumber;
  skewScale: ethers.BigNumber;
}[];

export function bootstrapSynthMarkets(data: BootstrapSynthArgs, r: ReturnType<typeof createStakedPool>) {
  let contracts: Systems, marketOwner: ethers.Signer;

  before('identify actors', () => {
    contracts = r.systems() as unknown as Systems;
    [, , marketOwner] = r.signers();
  });

  const synthMarkets: SynthMarket[] = data.map(({ name, token, buyPrice, sellPrice, skewScale }) => {
    let marketId: ethers.BigNumber,
      buyNodeId: string,
      buyAggregator: AggregatorV3Mock,
      sellNodeId: string,
      sellAggregator: AggregatorV3Mock,
      synthAddress: string,
      synth: SynthRouter;

    before('create price nodes', async () => {
      const buyPriceNodeResult = await createOracleNode(r.signers()[0], buyPrice, contracts.OracleManager);
      const sellPriceNodeResult = await createOracleNode(r.signers()[0], sellPrice, contracts.OracleManager);
      buyNodeId = buyPriceNodeResult.oracleNodeId;
      buyAggregator = buyPriceNodeResult.aggregator;
      sellNodeId = sellPriceNodeResult.oracleNodeId;
      sellAggregator = sellPriceNodeResult.aggregator;
    });

    before('register synth', async () => {
      marketId = await contracts.SpotMarket.callStatic.createSynth(name, token, await marketOwner.getAddress());
      await contracts.SpotMarket.createSynth(name, token, await marketOwner.getAddress());
      await contracts.SpotMarket.connect(marketOwner).updatePriceData(marketId, buyNodeId, sellNodeId);
      await contracts.SpotMarket.connect(marketOwner).setMarketSkewScale(marketId, skewScale);

      synthAddress = await contracts.SpotMarket.getSynth(marketId);
      synth = contracts.Synth(synthAddress);
    });

    before('delegate collateral to market from pool', async () => {
      await contracts.Core.connect(r.owner()).setPoolConfiguration(r.poolId, [
        {
          marketId,
          weightD18: ethers.utils.parseEther('1'),
          maxDebtShareValueD18: ethers.utils.parseEther('1'),
        },
      ]);
    });

    before('allow synth as collateral in system', async () => {
      const tokenAddress = await contracts.SpotMarket.getSynth(marketId);
      await r.systems().Core.connect(r.owner()).configureCollateral({
        tokenAddress,
        oracleNodeId: buyNodeId,
        issuanceRatioD18: '5000000000000000000',
        liquidationRatioD18: '1500000000000000000',
        liquidationRewardD18: '20000000000000000000',
        minDelegationD18: '20000000000000000000',
        depositingEnabled: false,
      });
    });

    return {
      marketId: () => marketId,
      buyAggregator: () => buyAggregator,
      buyNodeId: () => buyNodeId,
      sellAggregator: () => sellAggregator,
      sellNodeId: () => sellNodeId,
      synth: () => synth,
      synthAddress: () => synthAddress,
    };
  });

  const restore = snapshotCheckpoint(r.provider);

  return {
    ...r,
    marketOwner: () => marketOwner,
    systems: () => contracts,
    synthMarkets: () => synthMarkets,
    restore,
  };
}
