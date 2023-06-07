import { ethers } from 'ethers';
import { DEFAULT_SETTLEMENT_STRATEGY, bn, bootstrapMarkets } from '../bootstrap';
import { fastForwardTo, getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
// import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { commitOrder } from '../helpers';

describe('Settle Offchain Async Order test', () => {
  const { systems, perpsMarkets, provider, trader1, keeper } = bootstrapMarkets({
    synthMarkets: [],
    perpsMarkets: [
      {
        name: 'Ether',
        token: 'snxETH',
        price: bn(1000),
        fundingParams: { skewScale: bn(100_000), maxFundingVelocity: bn(0) },
      },
    ],
    traderAccountIds: [2, 3],
  });
  let marketId: ethers.BigNumber;

  before('identify actors', async () => {
    marketId = perpsMarkets()[0].marketId();
  });

  before('add collateral', async () => {
    await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(10_000));
  });

  let startTime: number;
  before('commit order', async () => {
    await commitOrder({
      trader: trader1(),
      marketId: marketId,
      accountId: 2,
      sizeDelta: bn(1),
      settlementStrategyId: 0,
      acceptablePrice: bn(1_000),
      systems,
    });
    startTime = await getTime(provider());
  });

  describe('settle order', () => {
    let pythCallData: string, extraData: string;

    before('fast forward to settlement time', async () => {
      // fast forward to settlement
      await fastForwardTo(startTime + 6, provider());
    });

    before('setup bytes data', () => {
      extraData = ethers.utils.defaultAbiCoder.encode(['uint128', 'uint128'], [marketId, 2]);
      pythCallData = ethers.utils.solidityPack(
        ['bytes32', 'uint64'],
        [DEFAULT_SETTLEMENT_STRATEGY.feedId, startTime + 5]
      );
    });

    it('reverts with offchain info', async () => {
      const functionSig = systems().PerpsMarket.interface.getSighash('settlePythOrder');

      // Coverage tests use hardhat provider, and hardhat provider stringifies array differently
      // hre.network.name === 'hardhat'
      //   ? `[${pythSettlementStrategy.url}]`
      //   : pythSettlementStrategy.url;

      await assertRevert(
        systems().PerpsMarket.connect(keeper()).settle(marketId, 2),
        `OffchainLookup("${systems().PerpsMarket.address}", "${
          DEFAULT_SETTLEMENT_STRATEGY.url
        }", "${pythCallData}", "${functionSig}", "${extraData}")`
      );
    });

    describe('settle pyth order', () => {
      let pythPriceData: string;
      let updateFee: ethers.BigNumber;

      before('prepare data', async () => {
        // Get the latest price
        pythPriceData = await systems().MockPyth.createPriceFeedUpdateData(
          DEFAULT_SETTLEMENT_STRATEGY.feedId,
          1000_0000,
          1,
          -4,
          1000_0000,
          1,
          startTime + 6
        );
        updateFee = await systems().MockPyth.getUpdateFee([pythPriceData]);
      });

      before('settle', async () => {
        await systems()
          .PerpsMarket.connect(keeper())
          .settlePythOrder(pythPriceData, extraData, { value: updateFee });
      });

      // TODO: test event
      // it('emits event', async () => {});

      // TODO: test fees are paid (keeper should receive settlementReward)

      it('check position is live', async () => {
        const [pnl, funding, size] = await systems().PerpsMarket.getOpenPosition(2, marketId);
        assertBn.equal(pnl, bn(-0.005));
        assertBn.equal(funding, bn(0));
        assertBn.equal(size, bn(1));
      });
    });
  });
});
