import { bn, bootstrap } from '../../bootstrap';
import { wei } from '@synthetixio/wei';
import { utils } from 'ethers';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';

describe('PerpCollateralModule', async () => {
  // Hardcoding args here but this will eventually be moved into generators.
  const { traders, owner, systems, restore, markets } = bootstrap({
    pool: {
      initialCollateralPrice: bn(10_000),
    },
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
        initialPrice: bn(1000),
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

  beforeEach(restore);

  describe('transferTo()', () => {
    it('should allow deposit of collateral to my account');
    it('should affect an existing position when depositing');
    it('should not allow deposit to an account that does not exist');
    it('should not allow deposit of unsupported collateral');
    it('should not allow a deposit that exceeds max cap');

    it('should allow withdraw of collateral to my account');
    it('should affect an existing position when withdrawing');
    it('should not allow withdraw to an account that does not exist');
    it('should not allow withdraw of non-existent collateral');
    it('should not allow withdraw of more than what is available');
    it('should not allow position to be liquidatable when withdrawing');

    it('should not allow transfers at all when an order is pending');
  });

  describe('setCollateralConfiguration()', () => {
    it('should not allow non-owners from configuring collateral', async () => {
      const { PerpMarketProxy } = systems();

      const trader = await traders()[0].getAddress();
      await assertRevert(
        PerpMarketProxy.connect(trader).setCollateralConfiguration([], [], []),
        `Unauthorized("${trader}")`
      );
    });

    it('should successfully configure many collaterals');
    it('should clear previous collaterals when configuring with new');
    it('should revert when type is address(0)');
  });
});
