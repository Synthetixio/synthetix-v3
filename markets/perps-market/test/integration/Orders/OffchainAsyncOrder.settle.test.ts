import { ethers } from 'ethers';
import { bn, bootstrapMarkets } from '../bootstrap';
import { fastForwardTo, getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';

const ASYNC_OFFCHAIN_ORDER_TYPE = 1;
const ASYNC_OFFCHAIN_URL = 'https://fakeapi.pyth.synthetix.io/';

describe('Settle Offchain Async Order test - not using settle helpers', () => {
  const { systems, marketOwner, perpsMarkets, provider, trader1, keeper } = bootstrapMarkets({
    synthMarkets: [],
    perpsMarkets: [{ name: 'Ether', token: 'snxETH', price: bn(1000) }],
    traderAccountIds: [2, 3],
  });

  const feedId = ethers.utils.formatBytes32String('ETH/USD');

  let priceVerificationContract: string;
  let marketId: ethers.BigNumber;

  before('identify actors', async () => {
    marketId = perpsMarkets()[0].marketId();
    priceVerificationContract = systems().MockPyth.address;
  });

  before('create settlement strategy', async () => {
    await systems()
      .PerpsMarket.connect(marketOwner())
      .addSettlementStrategy(marketId, {
        strategyType: ASYNC_OFFCHAIN_ORDER_TYPE, // OFFCHAIN
        settlementDelay: 5,
        settlementWindowDuration: 120,
        priceVerificationContract: priceVerificationContract,
        feedId: feedId,
        url: ASYNC_OFFCHAIN_URL,
        disabled: false,
        settlementReward: bn(5),
        priceDeviationTolerance: bn(0.01),
      });
  });

  before('set skew scale', async () => {
    await systems().PerpsMarket.connect(marketOwner()).setSkewScale(marketId, bn(100_000));
  });

  before('add collateral', async () => {
    await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(10_000));
  });

  describe('commit order', async () => {
    let tx: ethers.ContractTransaction;
    let startTime: number;

    before('commit the order', async () => {
      tx = await systems()
        .PerpsMarket.connect(trader1())
        .commitOrder({
          marketId: marketId,
          accountId: 2,
          sizeDelta: bn(1),
          settlementStrategyId: 0,
          acceptablePrice: bn(1000),
          trackingCode: ethers.constants.HashZero,
        });
      startTime = await getTime(provider());
    });

    it('emit event', async () => {
      await assertEvent(
        tx,
        `OrderCommitted(${marketId}, 2, ${ASYNC_OFFCHAIN_ORDER_TYPE}, ${bn(1)}, ${bn(1000)}, ${
          startTime + 5
        }, ${startTime + 5 + 120}, "${
          ethers.constants.HashZero
        }", "${await trader1().getAddress()}"`,
        systems().PerpsMarket
      );
    });

    it('identifies the pending order', async () => {
      const pendingOrderSizeDelta = await systems().PerpsMarket.submittedAsyncOrder(2, marketId);
      assertBn.equal(pendingOrderSizeDelta, bn(1));
      // assertBn.equal(pendingOrder.acceptablePrice, bn(1000));
      // assertBn.equal(pendingOrder.settlementStrategyId, bn(0));
      // assertBn.equal(pendingOrder.startTime, bn(startTime + 5));
      // assertBn.equal(pendingOrder.endTime, bn(startTime + 5 + 120));
    });

    describe('settle order', () => {
      let pythCallData: string, extraData: string;

      before('fast forward to settlement time', async () => {
        // fast forward to settlement
        await fastForwardTo(startTime + 6, provider());
      });

      before('setup bytes data', () => {
        extraData = ethers.utils.defaultAbiCoder.encode(['uint128', 'uint128'], [marketId, 2]);
        pythCallData = ethers.utils.solidityPack(['bytes32', 'uint64'], [feedId, startTime + 5]);
      });

      it('reverts with offchain info', async () => {
        const functionSig = systems().PerpsMarket.interface.getSighash('settlePythOrder');

        const expectedUrl = ASYNC_OFFCHAIN_URL;
        // Coverage tests use hardhat provider, and hardhat provider stringifies array differently
        // hre.network.name === 'hardhat'
        //   ? `[${pythSettlementStrategy.url}]`
        //   : pythSettlementStrategy.url;

        await assertRevert(
          systems().PerpsMarket.connect(keeper()).settle(marketId, 2),
          `OffchainLookup("${
            systems().PerpsMarket.address
          }", "${expectedUrl}", "${pythCallData}", "${functionSig}", "${extraData}")`
        );
      });

      describe('settle pyth order', () => {
        let pythPriceData: string;
        let updateFee: ethers.BigNumber;

        before('prepare data', async () => {
          // Get the latest price
          pythPriceData = await systems().MockPyth.createPriceFeedUpdateData(
            feedId,
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
          tx = await systems()
            .PerpsMarket.connect(keeper())
            .settlePythOrder(pythPriceData, extraData, { value: updateFee });
        });

        // it('emits event', async () => {});

        it('check position is live', async () => {
          const [pnl, funding, size] = await systems().PerpsMarket.openPosition(2, marketId);
          assertBn.equal(pnl, bn(-0.005));
          assertBn.equal(funding, bn(0));
          assertBn.equal(size, bn(1));
        });
      });
    });
  });
});
