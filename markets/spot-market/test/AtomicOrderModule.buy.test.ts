import { ethers as Ethers } from 'ethers';
import { bn, bootstrapTraders, bootstrapWithSynth } from './bootstrap';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { SynthRouter } from '../generated/typechain';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';

describe('Atomic Order Module buy()', () => {
  const { systems, signers, marketId, restore } = bootstrapTraders(
    bootstrapWithSynth('Synthetic Ether', 'snxETH')
  ); // creates traders with USD

  let marketOwner: Ethers.Signer, trader1: Ethers.Signer, trader2: Ethers.Signer;
  let synth: SynthRouter;

  before('identify actors', async () => {
    [, , marketOwner, trader1, trader2] = signers();
  });

  before('identify synth', async () => {
    const synthAddress = await systems().SpotMarket.getSynth(1);
    synth = systems().Synth(synthAddress);
  });

  it('reverts on invalid market', async () => {
    await assertRevert(systems().SpotMarket.buy(25, 10000, 10000), 'InvalidMarket');
  });

  it('reverts when user does not have proper funds', async () => {
    await assertRevert(
      systems().SpotMarket.connect(signers()[8]).buy(marketId(), 10000, 10000),
      'InsufficientAllowance("10000", "0")'
    );
  });

  describe('no fees', () => {
    let withdrawableUsd: Ethers.BigNumber;
    let txn: Ethers.providers.TransactionResponse;
    before('buy 1 snxETH', async () => {
      withdrawableUsd = await systems().Core.getWithdrawableMarketUsd(marketId());
      await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(1000));
      txn = await systems().SpotMarket.connect(trader1).buy(marketId(), bn(1000), bn(1));
    });

    it('trader1 has 1 snxETH', async () => {
      assertBn.equal(await synth.balanceOf(await trader1.getAddress()), bn(1));
    });

    it('deposited 1000 usd to MM', async () => {
      assertBn.equal(
        await systems().Core.getWithdrawableMarketUsd(marketId()),
        withdrawableUsd.add(bn(1000))
      );
    });

    it('emits SynthBought event', async () => {
      await assertEvent(txn, `SynthBought(${marketId()}, ${bn(1)}, 0, 0)`, systems().SpotMarket);
    });
  });

  describe('fixed fee', () => {
    before(restore);

    let withdrawableUsd: Ethers.BigNumber;
    let txn: Ethers.providers.TransactionResponse;
    before('set fixed fee to 1%', async () => {
      await systems().SpotMarket.connect(marketOwner).setAtomicFixedFee(marketId(), bn(0.01));
    });

    before('buy 1 snxETH', async () => {
      withdrawableUsd = await systems().Core.getWithdrawableMarketUsd(marketId());
      await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(1000));
      txn = await systems().SpotMarket.connect(trader1).buy(marketId(), bn(1000), bn(0.99));
    });

    it('trader1 has 0.99 snxETH after fees', async () => {
      assertBn.equal(await synth.balanceOf(await trader1.getAddress()), bn(0.99));
    });

    // no fee collector so everything gets deposited to MM
    it('deposited 1000 usd to MM', async () => {
      assertBn.equal(
        await systems().Core.getWithdrawableMarketUsd(marketId()),
        withdrawableUsd.add(bn(1000))
      );
    });

    it('emits SynthBought event', async () => {
      await assertEvent(
        txn,
        `SynthBought(${marketId()}, ${bn(0.99)}, ${bn(10)}, 0)`,
        systems().SpotMarket
      );
    });
  });

  describe('utilization rate fees', async () => {
    before(restore);

    // market provided collateral = $100,000 snxUSD

    let withdrawableUsd: Ethers.BigNumber;
    before('set utilization fee to 1%', async () => {
      withdrawableUsd = await systems().Core.getWithdrawableMarketUsd(marketId());
      await systems()
        .SpotMarket.connect(marketOwner)
        .setMarketUtilizationFees(marketId(), bn(0.001)); // 0.1% charged for each % above utilization
    });

    before('buy 50 snxETH', async () => {
      await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(50_000));
      await systems().SpotMarket.connect(trader1).buy(marketId(), bn(50_000), bn(50));
    });

    describe('when utilization is under 100%', () => {
      // no fees if utilization is under 100%
      it('mints all synths without fees', async () => {
        assertBn.equal(await synth.balanceOf(await trader1.getAddress()), bn(50));
      });
    });

    describe('when utilization is over 100%', () => {
      before('buy 100 snxETH', async () => {
        await systems().USD.connect(trader2).approve(systems().SpotMarket.address, bn(100_000));
        await systems().SpotMarket.connect(trader2).buy(marketId(), bn(100_000), bn(97.5));
      });

      it('applies utilization fee', async () => {
        // 100% before utilization since we were under 100% utilization prior to fill
        // 150_000 / 100_000 = 150% after utilization
        // (150% (post) + 100% (pre)) / 2 = 125% average utilization
        // 25 * 0.1% = 2.5% fee
        assertBn.equal(await synth.balanceOf(await trader2.getAddress()), bn(97.5));
      });

      it('deposited all usd to MM', async () => {
        assertBn.equal(
          await systems().Core.getWithdrawableMarketUsd(marketId()),
          withdrawableUsd.add(bn(150_000))
        );
      });
    });
  });

  describe('skew fees', () => {
    before(restore);

    before('set skew scale to 100 snxETH', async () => {
      await systems().SpotMarket.connect(marketOwner).setMarketSkewScale(marketId(), bn(100));
    });

    describe('first trader buy', () => {
      before('buy 10 snxETH', async () => {
        await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(10_000));
        await systems().SpotMarket.connect(trader1).buy(marketId(), bn(10_000), bn(9.5));
      });

      it('trader1 gets 9.5 snxETH', async () => {
        // from 0 eth skew to 10 eth skew
        // 5% fee (average before/after fill 0 + 10 / 2)
        assertBn.equal(await synth.balanceOf(await trader1.getAddress()), bn(9.5));
      });
    });

    describe('next trader buy', () => {
      before('buy 10 more snxETH', async () => {
        await systems().USD.connect(trader2).approve(systems().SpotMarket.address, bn(10_000));
        await systems().SpotMarket.connect(trader2).buy(marketId(), bn(10_000), bn(8.55));
      });

      it('trader2 gets 8.55 snxETH', async () => {
        // from 9.5 eth skew to 19.5 eth skew
        // 14.5% fee (average before/after fill 9.5 + 19.5 / 2)
        assertBn.equal(await synth.balanceOf(await trader2.getAddress()), bn(8.55));
      });
    });
  });

  describe('all fees set', () => {
    before(restore);

    before('set all fees', async () => {
      /*
          NOTE: very unlikely both utilization and skew fees would be set at the same time
          but we test that the fees are additive and is supported.
        */
      await systems().SpotMarket.connect(marketOwner).setAtomicFixedFee(marketId(), bn(0.01));
      await systems()
        .SpotMarket.connect(marketOwner)
        .setMarketUtilizationFees(marketId(), bn(0.001));
      await systems().SpotMarket.connect(marketOwner).setMarketSkewScale(marketId(), bn(1000));
    });

    before('traders buy snxETH', async () => {
      await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(90_000));
      await systems().USD.connect(trader2).approve(systems().SpotMarket.address, bn(25_000));

      await systems()
        .SpotMarket.connect(trader1)
        .buy(marketId(), bn(90_000), bn(90 * 0.945)); // 90 eth
      await systems().SpotMarket.connect(trader2).buy(marketId(), bn(25_000), bn(22.185625)); // 25 eth
    });

    it('sent correct amounts of synth to trader 1', async () => {
      // fixed fee 1% + utilization fee 0% (under 100% utilization)
      //  + skew fee 4.5% (under 1000 eth skew) == 5.5% fee
      assertBn.equal(await synth.balanceOf(await trader1.getAddress()), bn(90 * 0.945));
    });

    it('sent correct amount of synth to trader 2', async () => {
      // current synth amount after fees from trader1 = 85.05 eth
      // total synth after trader2 buy = 110.05 eth
      // fixed fee = 1%
      // utilfee = (10.05 / 2) = 5.025 * 0.1% = 0.5025%
      // skew fee = (85.05 + 110.05 / 2) = 9.755%
      // total fees = 11.2575%
      assertBn.equal(await synth.balanceOf(await trader2.getAddress()), bn(22.185625));
    });

    describe('custom transactor fees', () => {
      before('set trader1 atomic fee to 0.1% bps', async () => {
        await systems()
          .SpotMarket.connect(marketOwner)
          .setCustomTransactorFees(marketId(), trader1.getAddress(), bn(0.001));
      });

      let previousTrader1Balance: Ethers.BigNumber;
      before('trader1 buys again', async () => {
        previousTrader1Balance = await synth.balanceOf(await trader1.getAddress());
        await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(1000));
        await systems().SpotMarket.connect(trader1).buy(marketId(), bn(1000), 0);
      });

      it('trader1 gets lower atomic fixed fee', async () => {
        // current synth amount from previous trades = 107.235625 eth
        // total synth after trader2 buy = 108.235625 eth
        // fixed fee = 0.1%
        // utilfee = 7.735625 (utilization) * 0.1 (utilization rate) = 0.7735625
        // skew fee = 10.7735625%
        // total fees = 10.7735625% + 0.7735625% + 0.1% = 11.647125%
        assertBn.equal(
          await synth.balanceOf(await trader1.getAddress()),
          previousTrader1Balance.add(bn(0.88352875))
        );
      });
    });
  });

  describe('custom fee collector', () => {
    before(restore);

    let feeCollectorMock: string,
      withdrawableUsd: Ethers.BigNumber,
      txn: Ethers.providers.TransactionResponse;

    before('identify initial withdrawal usd from market manager', async () => {
      withdrawableUsd = await systems().Core.getWithdrawableMarketUsd(marketId());
    });

    before('identify fee collector', () => {
      feeCollectorMock = systems().FeeCollectorMock.address;
    });

    before('set custom fee collector', async () => {
      await systems().SpotMarket.connect(marketOwner).setFeeCollector(marketId(), feeCollectorMock);
    });

    before('set fixed fee', async () => {
      await systems().SpotMarket.connect(marketOwner).setAtomicFixedFee(marketId(), bn(0.01));
    });

    before('trader buys snxETH', async () => {
      await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(100_000));
      txn = await systems().SpotMarket.connect(trader1).buy(marketId(), bn(100_000), bn(99)); // 90 eth
    });

    const expectedFee = bn(100_000 * 0.01);

    it('returned correct amount to trader', async () => {
      assertBn.equal(
        await synth.balanceOf(await trader1.getAddress()),
        bn(99) // 99 eth, 1% fee
      );
    });

    it('collected correct amount by fee collector', async () => {
      assertBn.equal(await systems().USD.balanceOf(feeCollectorMock), expectedFee.div(2));
    });

    it('deposited correct amount into market manager', async () => {
      assertBn.equal(
        await systems().Core.getWithdrawableMarketUsd(marketId()),
        withdrawableUsd.add(bn(99_500)) // 99_000 usd + 500 usd (half of 1% fee)
      );
    });

    it('emitted SynthBought event with correct params', async () => {
      await assertEvent(
        txn,
        `SynthBought(${marketId()}, ${bn(99)}, ${expectedFee}, ${expectedFee.div(2)})`,
        systems().SpotMarket
      );
    });
  });
});
