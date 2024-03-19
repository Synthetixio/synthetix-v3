import { ethers } from 'ethers';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { Systems } from '../bootstrap';
import { createStakedPool } from '@synthetixio/main/test/common';
import { MockPythExternalNode } from '@synthetixio/oracle-manager/typechain-types';
import { createPythNode } from '@synthetixio/oracle-manager/test/common';
import { SynthRouter } from '../generated/typechain';

export type SynthMarkets = Array<{
  marketId: () => ethers.BigNumber;
  buyAggregator: () => MockPythExternalNode;
  sellAggregator: () => MockPythExternalNode;
  synth: () => SynthRouter;
  synthAddress: () => string;
}>;

export type SynthArguments = Array<{
  name: string;
  token: string;
  buyPrice: ethers.BigNumber;
  sellPrice: ethers.BigNumber;
  skewScale?: ethers.BigNumber;
}>;

export const STRICT_PRICE_TOLERANCE = 60;

export function bootstrapSynthMarkets(
  data: SynthArguments,
  r: ReturnType<typeof createStakedPool>
) {
  let contracts: Systems, marketOwner: ethers.Signer;
  before('identify actors', () => {
    contracts = r.systems() as Systems;
    [, , marketOwner] = r.signers();
  });

  const synthMarkets: SynthMarkets = data.map(({ name, token, buyPrice, sellPrice, skewScale }) => {
    let marketId: ethers.BigNumber,
      buyNodeId: string,
      buyAggregator: MockPythExternalNode,
      sellNodeId: string,
      sellAggregator: MockPythExternalNode,
      synthAddress: string,
      synth: SynthRouter;

    before('create price nodes', async () => {
      const buyPriceNodeResult = await createPythNode(
        r.signers()[0],
        buyPrice,
        contracts.OracleManager
      );
      const sellPriceNodeResult = await createPythNode(
        r.signers()[0],
        sellPrice,
        contracts.OracleManager
      );
      buyNodeId = buyPriceNodeResult.oracleNodeId;
      buyAggregator = buyPriceNodeResult.aggregator;
      sellNodeId = sellPriceNodeResult.oracleNodeId;
      sellAggregator = sellPriceNodeResult.aggregator;
    });

    before('register synth', async () => {
      marketId = await contracts.SpotMarket.callStatic.createSynth(
        name,
        token,
        await marketOwner.getAddress()
      );
      await contracts.SpotMarket.createSynth(name, token, await marketOwner.getAddress());
      await contracts.SpotMarket.connect(marketOwner).updatePriceData(
        marketId,
        buyNodeId,
        sellNodeId,
        STRICT_PRICE_TOLERANCE
      );
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
        oracleNodeId: sellNodeId,
        issuanceRatioD18: '5000000000000000000',
        liquidationRatioD18: '1500000000000000000',
        liquidationRewardD18: '20000000000000000000',
        minDelegationD18: '20000000000000000000',
        depositingEnabled: false,
      });
    });

    if (skewScale) {
      before('set skew scale', async () => {
        await contracts.SpotMarket.connect(marketOwner).setMarketSkewScale(marketId, skewScale);
      });
    }

    return {
      marketId: () => marketId,
      buyAggregator: () => buyAggregator,
      sellAggregator: () => sellAggregator,
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
