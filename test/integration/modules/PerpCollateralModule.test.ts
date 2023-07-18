import { bn, bootstrap } from '../../bootstrap';
import { wei } from '@synthetixio/wei';
import assert from 'assert';
import { utils } from 'ethers';

describe('PerpCollateralModule', async () => {
  // Hardcoding args here but this will eventually be moved into generators.
  const { systems, owner, markets } = bootstrap({
    global: {
      minMarginUsd: bn(100),
      priceDivergencePercent: wei(0.02).toBN(),
      pythPublishTimeMin: 10,
      pythPublishTimeMax: 12,
      minOrderAge: 12,
      maxOrderAge: 60,
      minKeeperFeeUsd: bn(10),
      maxKeeperFeeUsd: bn(100),
      keeperProfitMarginPercent: wei(0.3).toBN(),
      keeperSettlementGasUnits: 1_200_000,
      keeperLiquidationGasUnits: 1_200_000,
      keeperLiquidationFeeUsd: bn(1),
    },
    markets: [
      {
        name: utils.formatBytes32String('ETHPERP'),
        initialPrice: bn(1900),
        specific: {
          oracleNodeId: utils.formatBytes32String(''),
          pythPriceFeedId: utils.formatBytes32String(''),
          skewScale: bn(1_000_000), // Consider just storing skewScale as is?
          makerFee: wei(0.0002).toBN(), // 2bps
          takerFee: wei(0.0006).toBN(), // 6bps
          maxLeverage: bn(55), // Consider just storing this without scaling out?
          maxMarketSize: bn(20_000),
          maxFundingVelocity: bn(9),
          liquidationBufferPercent: wei(0.0075).toBN(),
          liquidationFeePercent: wei(0.0002).toBN(),
          liquidationPremiumMultiplier: wei(1.5625).toBN(),
        },
      },
    ],
  });

  it('should do the thing', async () => {
    const { PerpMarketProxy } = systems();
    console.log(await PerpMarketProxy.marketParametersById(markets[0].marketId()));
    assert.equal(1, 1);
  });
});
