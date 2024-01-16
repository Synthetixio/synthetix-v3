import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import { fastForwardTo, getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { ethers } from 'ethers';
import { SynthRouter } from './generated/typechain';
import { bn, bootstrapTraders, bootstrapWithSynth } from './bootstrap';
import { SettlementStrategy } from './generated/typechain/SpotMarketProxy';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';

const ASYNC_BUY_TRANSACTION = 3;

describe('AsyncOrderModule pyth', () => {
  const { systems, signers, marketId, provider } = bootstrapTraders(
    bootstrapWithSynth('Synthetic Ether', 'snxETH')
  );

  let marketOwner: ethers.Signer,
    trader1: ethers.Signer,
    keeper: ethers.Signer,
    synth: SynthRouter,
    startTime: number,
    strategyId: number,
    pythSettlementStrategy: SettlementStrategy.DataStruct;

  before('identify', async () => {
    [, , marketOwner, trader1, , keeper] = signers();
    const synthAddress = await systems().SpotMarket.getSynth(marketId());
    synth = systems().Synth(synthAddress);
  });

  before('add settlement strategy', async () => {
    pythSettlementStrategy = {
      strategyType: 1, // pyth
      settlementDelay: 5,
      settlementWindowDuration: 120,
      priceVerificationContract: systems().MockPythERC7412Wrapper.address,
      feedId: ethers.utils.formatBytes32String('ETH/USD'),
      url: 'https://fakeapi.pyth.network/',
      settlementReward: bn(5),
      disabled: false,
      priceDeviationTolerance: bn(0.01),
      minimumUsdExchangeAmount: bn(0.000001),
      maxRoundingLoss: bn(0.000001),
    };

    strategyId = (
      await systems()
        .SpotMarket.connect(marketOwner)
        .callStatic.addSettlementStrategy(marketId(), pythSettlementStrategy)
    ).toNumber();
    await systems()
      .SpotMarket.connect(marketOwner)
      .addSettlementStrategy(marketId(), pythSettlementStrategy);
  });

  before('setup fixed fee', async () => {
    await systems().SpotMarket.connect(marketOwner).setAsyncFixedFee(marketId(), bn(0.01));
  });

  describe('commit order', () => {
    let commitTxn: ethers.providers.TransactionResponse;
    before('commit', async () => {
      await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(1000));
      commitTxn = await systems()
        .SpotMarket.connect(trader1)
        .commitOrder(
          marketId(),
          ASYNC_BUY_TRANSACTION,
          bn(1000),
          strategyId,
          bn(0.8),
          ethers.constants.AddressZero
        );
      startTime = await getTime(provider());
    });

    it('emits event', async () => {
      await assertEvent(
        commitTxn,
        `OrderCommitted(${marketId()}, ${ASYNC_BUY_TRANSACTION}, ${bn(
          1000
        )}, 1, "${await trader1.getAddress()}"`,
        systems().SpotMarket
      );
    });
  });

  describe('settle order', () => {
    let settleTxn: ethers.providers.TransactionResponse;
    before('fast forward to settle', async () => {
      await fastForwardTo(startTime + 6, provider());
    });

    before('set mock price', async () => {
      await systems().MockPythERC7412Wrapper.setBenchmarkPrice(bn(1100));
    });

    describe('handles revert properly', () => {
      before('set mock to revert', async () => {
        await systems().MockPythERC7412Wrapper.setAlwaysRevertFlag(true);
      });

      it('reverts', async () => {
        await assertRevert(
          systems().SpotMarket.connect(keeper).settleOrder(marketId(), 1),
          `OracleDataRequired(${pythSettlementStrategy.feedId}, ${startTime})`
        );
      });

      after('set mock back to normal', async () => {
        await systems().MockPythERC7412Wrapper.setAlwaysRevertFlag(false);
      });
    });

    describe('settle', () => {
      before('settle', async () => {
        settleTxn = await systems().SpotMarket.connect(keeper).settleOrder(marketId(), 1);
      });

      // ($1000 sent - $5 keeper) / ($1100/eth price) * 0.99 (1% fee) = 0.8955
      const expectedReturnAmt = bn(0.8955);

      it('sent correct amount to trader', async () => {
        assertBn.equal(await synth.balanceOf(await trader1.getAddress()), expectedReturnAmt);
      });

      it('emits settled event', async () => {
        await assertEvent(
          settleTxn,
          `OrderSettled(${marketId()}, 1, ${expectedReturnAmt}, [${bn(
            9.95
          )}, 0, 0, 0], 0, "${await keeper.getAddress()}"`,
          systems().SpotMarket
        );
      });
    });
  });

  describe('no Settlement Reward', () => {
    before('add settlement strategy with 0 settlement reward and commit an order', async () => {
      pythSettlementStrategy = {
        strategyType: 1, // pyth
        settlementDelay: 5,
        settlementWindowDuration: 120,
        priceVerificationContract: systems().MockPythERC7412Wrapper.address,
        feedId: ethers.utils.formatBytes32String('ETH/USD'),
        url: 'https://fakeapi.pyth.network/',
        settlementReward: 0,
        priceDeviationTolerance: bn(0.01),
        disabled: false,
        minimumUsdExchangeAmount: bn(0.000001),
        maxRoundingLoss: bn(0.000001),
      };

      const noSettlementStrategyId = (
        await systems()
          .SpotMarket.connect(marketOwner)
          .callStatic.addSettlementStrategy(marketId(), pythSettlementStrategy)
      ).toNumber();
      await systems()
        .SpotMarket.connect(marketOwner)
        .addSettlementStrategy(marketId(), pythSettlementStrategy);

      await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(1000));
      await systems()
        .SpotMarket.connect(trader1)
        .commitOrder(
          marketId(),
          ASYNC_BUY_TRANSACTION,
          bn(1000),
          noSettlementStrategyId,
          bn(0.8),
          ethers.constants.AddressZero
        );
      startTime = await getTime(provider());
    });

    before('settle', async () => {
      await fastForwardTo(startTime + 6, provider());
      await systems().SpotMarket.connect(keeper).settleOrder(marketId(), 2);
    });

    it('sent correct amount to trader', async () => {
      //0.8955 + 0.9 = 1.7955
      assertBn.equal(await synth.balanceOf(await trader1.getAddress()), bn(1.7955));
    });
  });
});
