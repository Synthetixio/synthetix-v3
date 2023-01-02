import { ethers as Ethers } from 'ethers';
import { wei } from '@synthetixio/wei';
import { bootstrapTraders, bootstrapWithSynth } from './bootstrap';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { SynthRouter } from '../generated/typechain';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';

const bn = (n: number) => wei(n).toBN();

describe.only('Atomic Order Module', () => {
  const { systems, signers, marketId, restore } = bootstrapTraders(
    bootstrapWithSynth('Synthetic Ether', 'snxETH')
  ); // creates traders with USD

  let owner: Ethers.Signer,
    marketOwner: Ethers.Signer,
    trader1: Ethers.Signer,
    trader2: Ethers.Signer;
  let synth: SynthRouter;

  before('identify actors', async () => {
    [owner, , marketOwner, trader1, trader2] = signers();
  });

  before('identify synth', async () => {
    const synthAddress = await systems().SpotMarket.getSynth(1);
    synth = systems().Synth(synthAddress);
  });

  describe('buy()', async () => {
    it('reverts on invalid market', async () => {
      await assertRevert(systems().SpotMarket.buy(25, 10000), 'InvalidMarket');
    });

    it('reverts when user does not have proper funds', async () => {
      await assertRevert(
        systems().SpotMarket.connect(signers()[8]).buy(marketId(), 10000),
        'InsufficientAllowance("10000", "0")'
      );
    });

    describe('no fees', () => {
      let withdrawableUsd: Ethers.BigNumber;
      let txn: Ethers.providers.TransactionResponse;
      before('buy 1 snxETH', async () => {
        withdrawableUsd = await systems().Core.getWithdrawableUsd(marketId());
        await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(1000));
        txn = await systems().SpotMarket.connect(trader1).buy(marketId(), bn(1000));
      });

      it('trader1 has 1 snxETH', async () => {
        assertBn.equal(await synth.balanceOf(await trader1.getAddress()), bn(1));
      });

      it('deposited 1000 usd to MM', async () => {
        assertBn.equal(
          await systems().Core.getWithdrawableUsd(marketId()),
          withdrawableUsd.add(bn(1000))
        );
      });

      it('emits SynthBought event', async () => {
        await assertEvent(txn, `SynthBought(${marketId()}, ${bn(1)}, 0)`, systems().SpotMarket);
      });
    });

    describe('fixed fee', () => {
      before(restore);

      let withdrawableUsd: Ethers.BigNumber;
      let txn: Ethers.providers.TransactionResponse;
      before('set fixed fee to 100 bps', async () => {
        await systems().SpotMarket.connect(marketOwner).setAtomicFixedFee(marketId(), bn(100));
      });

      before('buy 1 snxETH', async () => {
        withdrawableUsd = await systems().Core.getWithdrawableUsd(marketId());
        await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(1000));
        txn = await systems().SpotMarket.connect(trader1).buy(marketId(), bn(1000));
      });

      it('trader1 has 0.99 snxETH after fees', async () => {
        assertBn.equal(await synth.balanceOf(await trader1.getAddress()), bn(0.99));
      });

      // no fee collector so everything gets deposited to MM
      it('deposited 1000 usd to MM', async () => {
        assertBn.equal(
          await systems().Core.getWithdrawableUsd(marketId()),
          withdrawableUsd.add(bn(1000))
        );
      });

      it('emits SynthBought event', async () => {
        await assertEvent(
          txn,
          `SynthBought(${marketId()}, ${bn(0.99)}, ${bn(10)})`,
          systems().SpotMarket
        );
      });
    });

    describe('utilization rate fees', async () => {
      before(restore);

      // market provided collateral = $100,000 snxUSD

      let withdrawableUsd: Ethers.BigNumber;
      before('set utilization fee to 100 bps', async () => {
        withdrawableUsd = await systems().Core.getWithdrawableUsd(marketId());
        await systems()
          .SpotMarket.connect(marketOwner)
          .setMarketUtilizationFees(marketId(), bn(100));
      });

      describe('when utilization is under 100%', () => {
        before('buy 50 snxETH', async () => {
          await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(50_000));
          await systems().SpotMarket.connect(trader1).buy(marketId(), bn(50_000));
        });

        // no fees if utilization is under 100%
        it('mints all synths without fees', async () => {
          assertBn.equal(await synth.balanceOf(await trader1.getAddress()), bn(50));
        });
      });

      describe('when utilization is over 100%', () => {
        before('buy 100 snxETH', async () => {
          await systems().USD.connect(trader2).approve(systems().SpotMarket.address, bn(100_000));
          await systems().SpotMarket.connect(trader2).buy(marketId(), bn(100_000));
        });

        it('applies utilization fee', async () => {
          // 150_000 / 100_000 = 150% utilization
          // 100 bps * 1.5 = 150 bps fee
          assertBn.equal(await synth.balanceOf(await trader2.getAddress()), bn(98.5));
        });

        it('deposited all usd to MM', async () => {
          assertBn.equal(
            await systems().Core.getWithdrawableUsd(marketId()),
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
          await systems().SpotMarket.connect(trader1).buy(marketId(), bn(10_000));
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
          await systems().SpotMarket.connect(trader2).buy(marketId(), bn(10_000));
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
        await systems().SpotMarket.connect(marketOwner).setAtomicFixedFee(marketId(), bn(100));
        await systems()
          .SpotMarket.connect(marketOwner)
          .setMarketUtilizationFees(marketId(), bn(100));
        await systems().SpotMarket.connect(marketOwner).setMarketSkewScale(marketId(), bn(1000));
      });

      before('traders buy snxETH', async () => {
        await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(90_000));
        await systems().USD.connect(trader2).approve(systems().SpotMarket.address, bn(25_000));

        await systems().SpotMarket.connect(trader1).buy(marketId(), bn(90_000)); // 90 eth
        await systems().SpotMarket.connect(trader2).buy(marketId(), bn(25_000)); // 25 eth
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
        // utilfee = 1.1005%  (percent above utilization)
        // skew fee = (85.05 + 110.05 / 2) = 9.755%
        // total fees = 11.8555%
        assertBn.equal(await synth.balanceOf(await trader2.getAddress()), bn(22.036125));
      });

      describe('custom transactor fees', () => {
        before('set trader1 atomic fee to 10 bps', async () => {
          await systems()
            .SpotMarket.connect(marketOwner)
            .setCustomTransactorFees(marketId(), trader1.getAddress(), bn(10));
        });

        let previousTrader1Balance: Ethers.BigNumber;
        before('trader1 buys again', async () => {
          previousTrader1Balance = await synth.balanceOf(await trader1.getAddress());
          await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(1000));
          await systems().SpotMarket.connect(trader1).buy(marketId(), bn(1000));
        });

        it('trader1 gets lower atomic fixed fee', async () => {
          // current synth amount from previous trades = 107.086125 eth
          // total synth after trader2 buy = 108.086125 eth
          // fixed fee = 0.1%
          // utilfee = 1.08086125%  (percent above utilization)
          // skew fee = 10.7586125%
          // total fees = 10.7586125% + 1.08086125% + 0.1% = 11.93947375%
          assertBn.equal(
            await synth.balanceOf(await trader1.getAddress()),
            previousTrader1Balance.add(bn(0.8806052625))
          );
        });
      });
    });
  });
});
