import { Signer, utils } from 'ethers';
import { bn, bootstrapTraders, bootstrapWithSynth } from './bootstrap';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import assert from 'assert';

const settlementStrategy = {
  strategyType: 0,
  settlementDelay: 500,
  settlementWindowDuration: 100,
  priceVerificationContract: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
  feedId: utils.formatBytes32String('feedId'),
  url: 'url',
  settlementReward: 100,
  priceDeviationTolerance: bn(0.01),
  minimumUsdExchangeAmount: bn(0.01),
  maxRoundingLoss: bn(0.0001),
  disabled: true,
};
const updatedSettlementStrategy = {
  strategyType: 0,
  settlementDelay: 1000,
  settlementWindowDuration: 200,
  priceVerificationContract: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
  feedId: utils.formatBytes32String('feedId'),
  url: 'url',
  settlementReward: 200,
  priceDeviationTolerance: bn(0.02),
  minimumUsdExchangeAmount: bn(0.02),
  maxRoundingLoss: bn(0.0002),
  disabled: false,
};

describe('AsyncOrderConfigurationModule', () => {
  const { systems, signers, marketId, marketOwner } = bootstrapTraders(
    bootstrapWithSynth('Synthetic Ether', 'snxETH')
  );

  let randomUser: Signer;
  before('identify actors', async () => {
    randomUser = signers()[3];
  });

  const checkStrategy = (expectedStrategy: typeof settlementStrategy) => {
    it('has correct strategy values', async () => {
      const returnedStrategy = await systems()
        .SpotMarket.connect(marketOwner())
        .getSettlementStrategy(marketId(), 0);

      assertBn.equal(returnedStrategy.settlementDelay, expectedStrategy.settlementDelay);
      assertBn.equal(
        returnedStrategy.settlementWindowDuration,
        expectedStrategy.settlementWindowDuration
      );
      assert.equal(
        returnedStrategy.priceVerificationContract,
        expectedStrategy.priceVerificationContract
      );
      assertBn.equal(returnedStrategy.settlementReward, expectedStrategy.settlementReward);
      assert.equal(returnedStrategy.disabled, expectedStrategy.disabled);
      assert.equal(returnedStrategy.url, expectedStrategy.url);
      assert.equal(returnedStrategy.feedId, expectedStrategy.feedId);
      assertBn.equal(
        returnedStrategy.priceDeviationTolerance,
        expectedStrategy.priceDeviationTolerance
      );
      assertBn.equal(
        returnedStrategy.minimumUsdExchangeAmount,
        expectedStrategy.minimumUsdExchangeAmount
      );
      assertBn.equal(returnedStrategy.maxRoundingLoss, expectedStrategy.maxRoundingLoss);
    });
  };

  describe('adding strategy', () => {
    it('fails using non-owner', async () => {
      await assertRevert(
        systems()
          .SpotMarket.connect(signers()[3])
          .addSettlementStrategy(marketId(), settlementStrategy),
        `OnlyMarketOwner`
      );
    });

    it('emits event on success', async () => {
      await assertEvent(
        await systems()
          .SpotMarket.connect(marketOwner())
          .addSettlementStrategy(marketId(), settlementStrategy),
        `SettlementStrategyAdded(${marketId()}, 0)`,
        systems().SpotMarket
      );
    });

    checkStrategy(settlementStrategy);
  });

  describe('updating strategy', () => {
    describe('when not owner', () => {
      it('reverts', async () => {
        await assertRevert(
          systems()
            .SpotMarket.connect(randomUser)
            .setSettlementStrategyEnabled(marketId(), 0, true),
          `OnlyMarketOwner`
        );

        await assertRevert(
          systems()
            .SpotMarket.connect(randomUser)
            .setSettlementStrategy(marketId(), 0, settlementStrategy),
          `OnlyMarketOwner`
        );
      });
    });

    describe('when strategy doesnt exist', () => {
      it('reverts', async () => {
        await assertRevert(
          systems()
            .SpotMarket.connect(marketOwner())
            .setSettlementStrategyEnabled(marketId(), 1, true),
          `InvalidSettlementStrategy`
        );

        await assertRevert(
          systems()
            .SpotMarket.connect(marketOwner())
            .setSettlementStrategy(marketId(), 1, settlementStrategy),
          `InvalidSettlementStrategy`
        );
      });
    });

    describe('updating disabled flag', () => {
      it('emits event', async () => {
        const expectedStrategy = [
          settlementStrategy.strategyType,
          settlementStrategy.settlementDelay,
          settlementStrategy.settlementWindowDuration,
          `"${settlementStrategy.priceVerificationContract}"`,
          `"${settlementStrategy.feedId}"`,
          `"${settlementStrategy.url}"`,
          settlementStrategy.settlementReward,
          settlementStrategy.priceDeviationTolerance,
          settlementStrategy.minimumUsdExchangeAmount,
          settlementStrategy.maxRoundingLoss,
          false,
        ].join(', ');

        await assertEvent(
          await systems()
            .SpotMarket.connect(marketOwner())
            .setSettlementStrategyEnabled(marketId(), 0, true),
          `SettlementStrategySet(${marketId()}, 0, [${expectedStrategy}]`,
          systems().SpotMarket
        );
      });
    });

    describe('update strategy', () => {
      it('owner can update settlement strategy and events are emitted', async () => {
        const txn = await systems()
          .SpotMarket.connect(marketOwner())
          .setSettlementStrategy(marketId(), 0, updatedSettlementStrategy);

        const expectedStrategy = [
          updatedSettlementStrategy.strategyType,
          updatedSettlementStrategy.settlementDelay,
          updatedSettlementStrategy.settlementWindowDuration,
          `"${updatedSettlementStrategy.priceVerificationContract}"`,
          `"${updatedSettlementStrategy.feedId}"`,
          `"${updatedSettlementStrategy.url}"`,
          updatedSettlementStrategy.settlementReward,
          updatedSettlementStrategy.priceDeviationTolerance,
          updatedSettlementStrategy.minimumUsdExchangeAmount,
          updatedSettlementStrategy.maxRoundingLoss,
          updatedSettlementStrategy.disabled,
        ].join(', ');

        await assertEvent(
          txn,
          `SettlementStrategySet(${marketId()}, 0, [${expectedStrategy}]`,
          systems().SpotMarket
        );
      });

      checkStrategy(updatedSettlementStrategy);
    });

    describe('when setting strategy with window duration 0', () => {
      it('reverts', async () => {
        const newStrategy = {
          ...updatedSettlementStrategy,
          settlementWindowDuration: 0,
        };

        await assertRevert(
          systems()
            .SpotMarket.connect(marketOwner())
            .setSettlementStrategy(marketId(), 0, newStrategy),
          `InvalidSettlementWindowDuration`
        );
      });
    });

    describe('when setting delay to 0', () => {
      it('sets it to 1', async () => {
        const newStrategy = {
          ...updatedSettlementStrategy,
          settlementDelay: 0,
        };

        await systems()
          .SpotMarket.connect(marketOwner())
          .setSettlementStrategy(marketId(), 0, newStrategy);

        const returnedStrategy = await systems()
          .SpotMarket.connect(marketOwner())
          .getSettlementStrategy(marketId(), 0);

        assertBn.equal(returnedStrategy.settlementDelay, 1);
      });
    });
  });
});
