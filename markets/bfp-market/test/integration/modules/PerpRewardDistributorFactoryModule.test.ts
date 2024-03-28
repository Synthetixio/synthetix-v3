import assert from 'assert';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { wei } from '@synthetixio/wei';
import { assertEvents } from '../../assert';
import { bootstrap } from '../../bootstrap';
import {
  bn,
  genAddress,
  genBootstrap,
  genBytes32,
  genOneOf,
  genOrder,
  genSide,
  genTrader,
} from '../../generators';
import {
  ADDRESS0,
  commitAndSettle,
  depositMargin,
  extendContractAbi,
  findEventSafe,
  withExplicitEvmMine,
} from '../../helpers';

describe('PerpRewardDistributorFactoryModule', () => {
  const bs = bootstrap(genBootstrap());
  const { traders, pool, owner, keeper, collateralsWithoutSusd, systems, provider, restore } = bs;

  beforeEach(restore);

  describe('createRewardDistributor', () => {
    it('should be able to create a new reward distributor', async () => {
      const { BfpMarketProxy, CollateralMockD18 } = systems();

      const args = {
        poolId: pool().id,
        collateralTypes: [genAddress(), genAddress()],
        name: genBytes32(),
        token: CollateralMockD18.address,
      };
      const distributor =
        await BfpMarketProxy.connect(owner()).callStatic.createRewardDistributor(args);

      const { receipt } = await withExplicitEvmMine(
        () => BfpMarketProxy.connect(owner()).createRewardDistributor(args),
        provider()
      );
      const rewardDistributorCreatedEvent = findEventSafe(
        receipt,
        'RewardDistributorCreated',
        BfpMarketProxy
      );

      assert.equal(distributor, rewardDistributorCreatedEvent.args.distributor);
    });

    it('should emit all events in correct order', async () => {
      const { BfpMarketProxy, CollateralMockD18 } = systems();

      const contractsWithAllEvents = extendContractAbi(
        BfpMarketProxy,
        ['event Initialized(uint8 version)'] // OZ Initializer
      );

      const args = {
        poolId: pool().id,
        collateralTypes: [genAddress()],
        name: genBytes32(),
        token: CollateralMockD18.address,
      };
      const distributor =
        await BfpMarketProxy.connect(owner()).callStatic.createRewardDistributor(args);

      const { receipt } = await withExplicitEvmMine(
        () => BfpMarketProxy.connect(owner()).createRewardDistributor(args),
        provider()
      );

      await assertEvents(
        receipt,
        ['Initialized(1)', `RewardDistributorCreated("${distributor}")`],
        contractsWithAllEvents
      );
    });

    it('should revert when token does not have decimal 18', async () => {
      const { BfpMarketProxy, CollateralMockD8 } = systems();

      await assertRevert(
        BfpMarketProxy.connect(owner()).createRewardDistributor({
          poolId: pool().id,
          collateralTypes: [genAddress()],
          name: genBytes32(),
          token: CollateralMockD8.address,
        }),
        'InvalidParameter("payoutToken", "Token decimals expected to be 18")',
        BfpMarketProxy
      );
    });

    it('should revert when not erc20', async () => {
      const { BfpMarketProxy } = systems();

      await assertRevert(
        BfpMarketProxy.connect(owner()).createRewardDistributor({
          poolId: pool().id,
          collateralTypes: [genAddress()],
          name: genBytes32(),
          token: genAddress(),
        }),
        'InvalidParameter("payoutToken", "Token decimals expected to be 18")',
        BfpMarketProxy
      );
    });

    it('should revert when any collateralType is address(0)', async () => {
      const { BfpMarketProxy, CollateralMockD18 } = systems();

      await assertRevert(
        BfpMarketProxy.connect(owner()).createRewardDistributor({
          poolId: pool().id,
          collateralTypes: [genAddress(), ADDRESS0],
          name: genBytes32(),
          token: CollateralMockD18.address,
        }),
        `ZeroAddress()`,
        BfpMarketProxy
      );
    });

    it('should revert when token is address(0)', async () => {
      const { BfpMarketProxy } = systems();

      await assertRevert(
        BfpMarketProxy.connect(owner()).createRewardDistributor({
          poolId: pool().id,
          collateralTypes: [genAddress()],
          name: genBytes32(),
          token: ADDRESS0,
        }),
        `ZeroAddress()`,
        BfpMarketProxy
      );
    });

    it('should revert when empty collateralTypes length', async () => {
      const { BfpMarketProxy } = systems();

      await assertRevert(
        BfpMarketProxy.connect(owner()).createRewardDistributor({
          poolId: pool().id,
          collateralTypes: [],
          name: genBytes32(),
          token: genAddress(),
        }),
        `ZeroLength()`,
        BfpMarketProxy
      );
    });

    it('should revert when market owner is not msg.sender', async () => {
      const { BfpMarketProxy } = systems();

      const from = genOneOf(traders()).signer;
      await assertRevert(
        BfpMarketProxy.connect(from).createRewardDistributor({
          poolId: pool().id,
          collateralTypes: [genAddress(), genAddress()],
          name: genBytes32(),
          token: genAddress(),
        }),
        `Unauthorized("${await from.getAddress()}")`,
        BfpMarketProxy
      );
    });
  });

  describe('Core.RewardsManagerModule.claimReward', () => {
    it('should be able to claim a distributed reward', async () => {
      const { BfpMarketProxy, Core } = systems();

      // NOTE: We _cannot_ use sUSD collateral because this will not be distributed.
      const orderSide = genSide();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, { desiredCollateral: genOneOf(collateralsWithoutSusd()) })
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 10,
        desiredSide: orderSide,
      });

      await commitAndSettle(bs, marketId, trader, order);

      // Price falls/rises between 10% should results in a healthFactor of < 1.
      //
      // Whether it goes up or down depends on the side of the order.
      const newMarketOraclePrice = wei(order.oraclePrice)
        .mul(orderSide === 1 ? 0.9 : 1.1)
        .toBN();
      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

      const { receipt: flagReceipt } = await withExplicitEvmMine(
        () => BfpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId),
        provider()
      );
      const transferEvent = findEventSafe(
        flagReceipt,
        'Transfer',
        extendContractAbi(BfpMarketProxy, [
          'event Transfer(address indexed from, address indexed to, uint256 value)',
        ])
      );
      const amountTransferedForDistribution = transferEvent.args.value;

      assertBn.equal(collateralDepositAmount, amountTransferedForDistribution);

      // Liquidated rewards should be claimable by LP immediately.
      const { receipt: claimReceipt } = await withExplicitEvmMine(
        () =>
          Core.connect(pool().staker()).claimRewards(
            pool().stakerAccountId,
            pool().id,
            pool().collateral().address,
            collateral.rewardDistributorAddress()
          ),
        provider()
      );
      const claimEvent = findEventSafe(claimReceipt, 'RewardsClaimed', Core);

      // Expect the liquidated collateral amount to be equal to the amount claimed.
      //
      // NOTE: This is only successful due to the way pools are configured in the test environment. This
      // must change if/when we add more LPs and/or collaterals/distributors.
      //
      // There are also minor rounding errors from distribution calcs.
      assertBn.near(amountTransferedForDistribution, claimEvent.args.amount, bn(0.0001));
    });
  });
});
