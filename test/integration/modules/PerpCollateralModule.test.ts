import { wei } from '@synthetixio/wei';
import { utils } from 'ethers';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assert from 'assert';
import { bn, bootstrap } from '../../bootstrap';
import { genAddress, genBytes32, genInt, genListOf } from '../../generators';

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
    it('should revert deposit to an account that does not exist');
    it('should revert deposit of unsupported collateral');
    it('should revert deposit that exceeds max cap');

    it('should allow withdraw of collateral to my account');
    it('should affect an existing position when withdrawing');
    it('should revert withdraw to an account that does not exist');
    it('should revert withdraw of unsupported collateral');
    it('should revert withdraw of more than what is available');
    it('should revert withdraw when position can be liquidated');

    it('should revert transfers when an order is pending');
  });

  describe('setCollateralConfiguration()', () => {
    it('should successfully configure many collaterals', async () => {
      const { PerpMarketProxy } = systems();
      const from = owner();

      const n = genInt(5, 10);
      const collateralTypes = genListOf(n, () => genAddress());
      const oracleNodeIds = genListOf(n, () => genBytes32());
      const maxAllowables = genListOf(n, () => bn(genInt(10_000, 100_000)));

      const tx = await PerpMarketProxy.connect(from).setCollateralConfiguration(
        collateralTypes,
        oracleNodeIds,
        maxAllowables
      );
      const collaterals = await PerpMarketProxy.getConfiguredCollaterals();

      assert.equal(collaterals.length, n);
      collaterals.forEach((collateral, i) => {
        const { maxAllowable, collateralType, oracleNodeId } = collateral;
        assertBn.equal(maxAllowable, maxAllowables[i]);
        assert.equal(collateralType, collateralTypes[i]);
        assert.equal(oracleNodeId, oracleNodeIds[i]);
      });

      await assertEvent(tx, `CollateralConfigured("${await from.getAddress()}", ${n})`, PerpMarketProxy);
    });

    it('should reset existing collaterals when new config is empty', async () => {
      const { PerpMarketProxy } = systems();
      const from = owner();

      await PerpMarketProxy.connect(from).setCollateralConfiguration([], [], []);
      const collaterals = await PerpMarketProxy.getConfiguredCollaterals();

      assert.equal(collaterals.length, 0);
    });

    it('should revert when non-owners configuring collateral', async () => {
      const { PerpMarketProxy } = systems();
      const from = await traders()[0].getAddress();
      await assertRevert(
        PerpMarketProxy.connect(from).setCollateralConfiguration([], [], []),
        `Unauthorized("${from}")`
      );
    });

    it('should revert when max allowable is negative', async () => {
      const { PerpMarketProxy } = systems();
      const from = owner();
      await assertRevert(
        PerpMarketProxy.connect(from).setCollateralConfiguration([genAddress()], [genBytes32()], [bn(-1)]),
        'Error: value out-of-bounds'
      );
    });

    it('should revert when type is address(0)', async () => {
      const { PerpMarketProxy } = systems();
      const from = owner();
      const zeroAddress = '0x0000000000000000000000000000000000000000';
      await assertRevert(
        PerpMarketProxy.connect(from).setCollateralConfiguration([zeroAddress], [genBytes32()], [bn(genInt())]),
        'ZeroAddress'
      );
    });
  });
});
