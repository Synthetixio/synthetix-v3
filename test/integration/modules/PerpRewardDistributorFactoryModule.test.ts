import assert from 'assert';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { wei } from '@synthetixio/wei';
import { bootstrap } from '../../bootstrap';
import { bn, genAddress, genBootstrap, genBytes32, genOneOf, genOrder, genSide, genTrader } from '../../generators';
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
      const { PerpMarketProxy } = systems();

      const args = {
        poolId: pool().id,
        collateralTypes: [genAddress(), genAddress()],
        name: genBytes32(),
        token: genAddress(),
      };
      const distributor = await PerpMarketProxy.connect(owner()).callStatic.createRewardDistributor(args);

      const { receipt } = await withExplicitEvmMine(
        () => PerpMarketProxy.connect(owner()).createRewardDistributor(args),
        provider()
      );
      const rewardDistributorCreatedEvent = findEventSafe(receipt, 'RewardDistributorCreated', PerpMarketProxy);

      assert.equal(distributor, rewardDistributorCreatedEvent.args.distributor);
    });

    it('should emit all events in correct order');

    it('should revert when any collateralType is address(0)', async () => {
      const { PerpMarketProxy } = systems();

      await assertRevert(
        PerpMarketProxy.connect(owner()).createRewardDistributor({
          poolId: pool().id,
          collateralTypes: [genAddress(), ADDRESS0],
          name: genBytes32(),
          token: genAddress(),
        }),
        `ZeroAddress()`,
        PerpMarketProxy
      );
    });

    it('should revert when token is address(0)', async () => {
      const { PerpMarketProxy } = systems();

      await assertRevert(
        PerpMarketProxy.connect(owner()).createRewardDistributor({
          poolId: pool().id,
          collateralTypes: [genAddress()],
          name: genBytes32(),
          token: ADDRESS0,
        }),
        `ZeroAddress()`,
        PerpMarketProxy
      );
    });

    it('should revert when empty collateralTypes length', async () => {
      const { PerpMarketProxy } = systems();

      await assertRevert(
        PerpMarketProxy.connect(owner()).createRewardDistributor({
          poolId: pool().id,
          collateralTypes: [],
          name: genBytes32(),
          token: genAddress(),
        }),
        `ZeroLength()`,
        PerpMarketProxy
      );
    });

    it('should revert when market owner is not msg.sender', async () => {
      const { PerpMarketProxy } = systems();

      const from = genOneOf(traders()).signer;
      await assertRevert(
        PerpMarketProxy.connect(from).createRewardDistributor({
          poolId: pool().id,
          collateralTypes: [genAddress(), genAddress()],
          name: genBytes32(),
          token: genAddress(),
        }),
        `Unauthorized("${await from.getAddress()}")`,
        PerpMarketProxy
      );
    });
  });

  describe('Core.RewardsManagerModule.claimReward', () => {
    it('should be able to claim a distributed reward', async () => {
      const { PerpMarketProxy, Core } = systems();

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
        () => PerpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId),
        provider()
      );
      const transferEvent = findEventSafe(
        flagReceipt,
        'Transfer',
        extendContractAbi(PerpMarketProxy, ['event Transfer(address indexed from, address indexed to, uint256 value)'])
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
