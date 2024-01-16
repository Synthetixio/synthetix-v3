import { ethers as Ethers } from 'ethers';
import { bn, bootstrapTraders, bootstrapWithSynth } from './bootstrap';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { SynthRouter } from './generated/typechain';
import { fastForwardTo, getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';

const settlementStrategyWithNoMin = {
  strategyType: 0,
  settlementDelay: 5,
  settlementWindowDuration: 120,
  priceVerificationContract: Ethers.constants.AddressZero,
  feedId: Ethers.constants.HashZero,
  url: '',
  settlementReward: 0,
  minimumUsdExchangeAmount: 0,
  maxRoundingLoss: bn(0.000001),
  priceDeviationTolerance: bn(0.01),
  disabled: false,
};

const settlementStrategyWithMin = {
  ...settlementStrategyWithNoMin,
  minimumUsdExchangeAmount: bn(0.000001),
};

const ASYNC_SELL_TRANSACTION_TYPE = 4;

describe('AsyncOrderModule escrow tests', () => {
  const { systems, signers, marketId, aggregator, provider } = bootstrapTraders(
    bootstrapWithSynth('Synthetic Ether', 'snxETH')
  );

  let marketOwner: Ethers.Signer, trader: Ethers.Signer, attacker: Ethers.Signer;
  let synth: SynthRouter, strategyIdWithNoMin: number, strategyIdWithMin: number, startTime: number;

  before('identify actors', async () => {
    [, , marketOwner, trader, attacker] = signers();
  });

  before('set synth price', async () => {
    await aggregator().mockSetCurrentPrice(bn(1000));
  });

  before('identify synth', async () => {
    const synthAddress = await systems().SpotMarket.getSynth(marketId());
    synth = systems().Synth(synthAddress);
  });

  before('infinite approve', async () => {
    await systems()
      .USD.connect(trader)
      .approve(systems().SpotMarket.address, Ethers.constants.MaxUint256);
    await systems()
      .USD.connect(attacker)
      .approve(systems().SpotMarket.address, Ethers.constants.MaxUint256);
    await synth.connect(trader).approve(systems().SpotMarket.address, Ethers.constants.MaxUint256);
    await synth
      .connect(attacker)
      .approve(systems().SpotMarket.address, Ethers.constants.MaxUint256);
  });

  before('add settlement strategies', async () => {
    strategyIdWithNoMin = (
      await systems()
        .SpotMarket.connect(marketOwner)
        .callStatic.addSettlementStrategy(marketId(), settlementStrategyWithNoMin)
    ).toNumber();
    await systems()
      .SpotMarket.connect(marketOwner)
      .addSettlementStrategy(marketId(), settlementStrategyWithNoMin);
    strategyIdWithMin = (
      await systems()
        .SpotMarket.connect(marketOwner)
        .callStatic.addSettlementStrategy(marketId(), settlementStrategyWithMin)
    ).toNumber();
    await systems()
      .SpotMarket.connect(marketOwner)
      .addSettlementStrategy(marketId(), settlementStrategyWithMin);
  });

  // attacker and trader buy 100 snxETH
  before('buy synth', async () => {
    await systems()
      .SpotMarket.connect(trader)
      .buy(marketId(), bn(100_000), bn(0), Ethers.constants.AddressZero);
    await systems()
      .SpotMarket.connect(attacker)
      .buy(marketId(), bn(100_000), bn(0), Ethers.constants.AddressZero);
  });

  const restore = snapshotCheckpoint(provider);

  describe('inflation attack without min amount set', () => {
    // commit settlement reward + 1
    before('attacker commits sell', async () => {
      // order 1
      await systems().SpotMarket.connect(attacker).commitOrder(
        marketId(),
        ASYNC_SELL_TRANSACTION_TYPE,
        1, // 1 wei
        strategyIdWithNoMin,
        Ethers.constants.MaxUint256,
        Ethers.constants.AddressZero
      );
    });

    // front-run: attacker sends 50 snxETH to spot market directly
    before('attacker sends synth to spot market', async () => {
      await synth.connect(attacker).transfer(systems().SpotMarket.address, bn(50));
    });

    describe('new trader commits sell', () => {
      it('reverts, not allowing commitment due to shares not equaling synth value', async () => {
        await assertRevert(
          systems()
            .SpotMarket.connect(trader)
            .commitOrder(
              marketId(),
              ASYNC_SELL_TRANSACTION_TYPE,
              bn(50),
              strategyIdWithNoMin,
              bn(40_000),
              Ethers.constants.AddressZero
            ),
          'InsufficientSharesAmount'
        );
      });
    });
  });

  describe('inflation attack with min amount set', () => {
    before(restore);

    it('reverts, not allowing attacker to commit very small amount', async () => {
      await assertRevert(
        systems().SpotMarket.connect(attacker).commitOrder(
          marketId(),
          ASYNC_SELL_TRANSACTION_TYPE,
          1, // 1 wei
          strategyIdWithMin,
          Ethers.constants.MaxUint256,
          Ethers.constants.AddressZero
        ),
        'InvalidCommitmentAmount'
      );
    });
  });

  describe('with mins met', () => {
    before(restore);

    before('attacker commits min amount', async () => {
      await systems()
        .SpotMarket.connect(attacker)
        .commitOrder(
          marketId(),
          ASYNC_SELL_TRANSACTION_TYPE,
          settlementStrategyWithMin.minimumUsdExchangeAmount,
          strategyIdWithMin,
          Ethers.constants.MaxUint256,
          Ethers.constants.AddressZero
        );
    });

    // front-run: attacker sends 50 snxETH to spot market directly
    before('attacker sends synth to spot market', async () => {
      await synth.connect(attacker).transfer(systems().SpotMarket.address, bn(50));
    });

    // trader commits to selling 50 snxETH
    before('trader commits to selling 50 snxETH', async () => {
      startTime = await getTime(provider());
      // order 2
      await systems()
        .SpotMarket.connect(trader)
        .commitOrder(
          marketId(),
          ASYNC_SELL_TRANSACTION_TYPE,
          bn(50),
          strategyIdWithMin,
          bn(40_000),
          Ethers.constants.AddressZero
        );
    });

    describe('trader gets correct funds', () => {
      let previousUsdBalance: Ethers.BigNumber;
      before('fast forward past cancellation', async () => {
        await fastForwardTo(startTime + 10, provider());
      });
      before('trader settles', async () => {
        previousUsdBalance = await systems().USD.balanceOf(await trader.getAddress());
        await systems().SpotMarket.connect(trader).settleOrder(marketId(), 2);
      });

      it('trader receives 50k USD', async () => {
        const currentUsdBalance = await systems().USD.balanceOf(await trader.getAddress());
        const usdReceived = currentUsdBalance.sub(previousUsdBalance);
        assertBn.near(usdReceived, bn(50_000), bn(0.0001));
      });
    });

    describe('attack', () => {
      before('fast forward past cancellation', async () => {
        await fastForwardTo(startTime + 130, provider());
      });
      let previousSynthBalance: Ethers.BigNumber;
      before('attacker cancels first order', async () => {
        previousSynthBalance = await synth.balanceOf(await attacker.getAddress());
        await systems().SpotMarket.connect(attacker).cancelOrder(marketId(), 1);
      });

      it('attacker only receives the 1 wei + 50 snxETH transferred after 1st order', async () => {
        const currentSynthBalance = await synth.balanceOf(await attacker.getAddress());
        const synthReceived = currentSynthBalance.sub(previousSynthBalance);
        assertBn.near(synthReceived, bn(50), bn(0.0001));
      });
    });
  });
});
