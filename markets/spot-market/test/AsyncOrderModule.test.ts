import { ethers } from 'ethers';
import { bn, bootstrapTraders, bootstrapWithSynth } from './bootstrap';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { SynthRouter } from './generated/typechain';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { fastForwardTo, getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';

const ASYNC_BUY_TRANSACTION = 3,
  ASYNC_SELL_TRANSACTION = 4;

describe('AsyncOrderModule', () => {
  const { systems, signers, marketId, provider } = bootstrapTraders(
    bootstrapWithSynth('Synthetic Ether', 'snxETH')
  );

  let marketOwner: ethers.Signer, trader1: ethers.Signer, synth: SynthRouter;

  before('identify', async () => {
    [, , marketOwner, trader1] = signers();
    const synthAddress = await systems().SpotMarket.getSynth(marketId());
    synth = systems().Synth(synthAddress);
  });

  before('add settlement strategy', async () => {
    await systems()
      .SpotMarket.connect(marketOwner)
      .addSettlementStrategy(marketId(), {
        strategyType: 0,
        settlementDelay: 5,
        settlementWindowDuration: 120,
        priceVerificationContract: ethers.constants.AddressZero,
        feedId: ethers.constants.HashZero,
        url: '',
        settlementReward: bn(5),
        disabled: false,
        priceDeviationTolerance: bn(0.01),
        minimumUsdExchangeAmount: bn(0.000001),
        maxRoundingLoss: bn(0.000001),
      });
  });

  before('setup fixed fee', async () => {
    await systems().SpotMarket.connect(marketOwner).setAsyncFixedFee(marketId(), bn(0.01));
  });

  describe('invalid market/claim ids', () => {
    it('reverts when trying to settle with invalid market id', async () => {
      await assertRevert(systems().SpotMarket.settleOrder(123123, 1), 'InvalidClaim');
    });

    it('reverts when trying to settle with non existing claim id', async () => {
      await assertRevert(systems().SpotMarket.settleOrder(marketId(), 123), 'InvalidClaim');
    });
  });

  describe('cancel order', () => {
    before('commit', async () => {
      await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(1000));
      await systems()
        .SpotMarket.connect(trader1)
        .commitOrder(
          marketId(),
          ASYNC_BUY_TRANSACTION,
          bn(1000),
          0,
          bn(0.8),
          ethers.constants.AddressZero
        );
    });

    before('fast forward', async () => {
      await fastForwardTo((await getTime(provider())) + 5, provider());
    });

    it('fails with invalid market or claim id', async () => {
      await assertRevert(systems().SpotMarket.cancelOrder(123123, 1), 'InvalidClaim');
      await assertRevert(systems().SpotMarket.cancelOrder(marketId(), 123), 'InvalidClaim');
    });

    it('fails when within settlement window', async () => {
      await assertRevert(
        systems().SpotMarket.cancelOrder(marketId(), 1),
        'IneligibleForCancellation'
      );
    });

    describe('after settlement window', () => {
      let previousBalance: ethers.BigNumber;
      before('fast forward', async () => {
        previousBalance = await systems().USD.balanceOf(await trader1.getAddress());
        await fastForwardTo((await getTime(provider())) + 120, provider());
      });

      before('cancel order', async () => {
        await systems().SpotMarket.cancelOrder(marketId(), 1);
      });

      it('returned funds to user', async () => {
        assertBn.equal(
          await systems().USD.balanceOf(await trader1.getAddress()),
          previousBalance.add(bn(1000))
        );
      });
    });

    describe('when cancelling after already cancelled', () => {
      it('reverts', async () => {
        await assertRevert(systems().SpotMarket.cancelOrder(marketId(), 1), 'OrderAlreadySettled');
      });
    });

    describe('when attempting to settle a cancelled order', () => {
      it('reverts', async () => {
        await assertRevert(systems().SpotMarket.settleOrder(marketId(), 1), 'OrderAlreadySettled');
      });
    });
  });

  describe('slippage protection', () => {
    describe('buy', () => {
      before('commit', async () => {
        await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(2000));
        // order # 2
        await systems()
          .SpotMarket.connect(trader1)
          .commitOrder(
            marketId(),
            ASYNC_BUY_TRANSACTION,
            bn(1000),
            0,
            bn(0.99),
            ethers.constants.AddressZero
          );
        // order # 3
        await systems()
          .SpotMarket.connect(trader1)
          .commitOrder(
            marketId(),
            ASYNC_BUY_TRANSACTION,
            bn(1000),
            0,
            bn(0.98),
            ethers.constants.AddressZero
          );
      });

      before('fast forward', async () => {
        await fastForwardTo((await getTime(provider())) + 5, provider());
      });

      it('reverts when minimum amount not met', async () => {
        // due to fees, user doesn't receive full 1 ether
        await assertRevert(
          systems().SpotMarket.settleOrder(marketId(), 2),
          `MinimumSettlementAmountNotMet(${bn(0.99)}, ${bn(0.98505)})`
        );
      });

      it('settles on minimum amount met', async () => {
        await systems().SpotMarket.settleOrder(marketId(), 3);
        assertBn.equal(await synth.balanceOf(await trader1.getAddress()), bn(0.98505));
      });
    });

    describe('sell', () => {
      let traderBalance: ethers.BigNumber;
      before('commit', async () => {
        traderBalance = await systems().USD.balanceOf(await trader1.getAddress());
        await synth.connect(trader1).approve(systems().SpotMarket.address, bn(0.5));
        // order # 4
        await systems()
          .SpotMarket.connect(trader1)
          .commitOrder(
            marketId(),
            ASYNC_SELL_TRANSACTION,
            bn(0.1),
            0,
            bn(85),
            ethers.constants.AddressZero
          ); // actual return is 84.15
        // order # 5
        await systems()
          .SpotMarket.connect(trader1)
          .commitOrder(
            marketId(),
            ASYNC_SELL_TRANSACTION,
            bn(0.1),
            0,
            bn(83),
            ethers.constants.AddressZero
          );
      });

      before('fast forward', async () => {
        await fastForwardTo((await getTime(provider())) + 5, provider());
      });

      it('reverts when minimum amount not met', async () => {
        // due to fees, user doesn't receive full 1 ether
        await assertRevert(
          systems().SpotMarket.settleOrder(marketId(), 4),
          `MinimumSettlementAmountNotMet(${bn(85)}, ${bn(84.1)})`
        );
      });

      it('settles on minimum amount met', async () => {
        await systems().SpotMarket.settleOrder(marketId(), 5);
        assertBn.equal(
          await systems().USD.balanceOf(await trader1.getAddress()),
          traderBalance.add(bn(84.1))
        );
      });
    });
  });
});
