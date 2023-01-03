import { ethers as Ethers } from 'ethers';
import { wei } from '@synthetixio/wei';
import { bootstrapTraders, bootstrapWithSynth } from './bootstrap';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { SynthRouter } from '../generated/typechain';
import { snapshotCheckpoint } from '@synthetixio/main/test/utils/snapshot';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';

const bn = (n: number) => wei(n).toBN();

describe.only('Atomic Order Module sell()', () => {
  const { systems, signers, marketId, provider } = bootstrapTraders(
    bootstrapWithSynth('Synthetic Ether', 'snxETH')
  ); // creates traders with USD

  let marketOwner: Ethers.Signer, trader1: Ethers.Signer, trader2: Ethers.Signer;
  let synth: SynthRouter;

  let initialTrader1Balance: Ethers.BigNumber, initialTrader2Balance: Ethers.BigNumber;

  before('identify actors', async () => {
    [, , marketOwner, trader1, trader2] = signers();
  });

  before('identify synth', async () => {
    const synthAddress = await systems().SpotMarket.getSynth(1);
    synth = systems().Synth(synthAddress);
  });

  before('setup traders', async () => {
    await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(10_000));
    await systems().SpotMarket.connect(trader1).buy(marketId(), bn(10_000));
    await systems().USD.connect(trader2).approve(systems().SpotMarket.address, bn(10_000));
    await systems().SpotMarket.connect(trader2).buy(marketId(), bn(10_000));
  });

  const restore = snapshotCheckpoint(provider);

  before('identify initial trader balances', async () => {
    initialTrader1Balance = await systems().USD.balanceOf(await trader1.getAddress());
    initialTrader2Balance = await systems().USD.balanceOf(await trader2.getAddress());
  });

  it('reverts on invalid market', async () => {
    await assertRevert(systems().SpotMarket.buy(25, 10000), 'InvalidMarket');
  });

  it('reverts when user does not have synth amount to sell', async () => {
    await assertRevert(
      systems().SpotMarket.connect(signers()[8]).sell(marketId(), 10000),
      'InsufficientBalance("10000", "0")'
    );
  });

  describe('no fees', () => {
    let withdrawableUsd: Ethers.BigNumber, txn: Ethers.providers.TransactionResponse;
    before('sell 1 snxETH', async () => {
      withdrawableUsd = await systems().Core.getWithdrawableUsd(marketId());
      await synth.connect(trader1).approve(systems().SpotMarket.address, bn(1));
      txn = await systems().SpotMarket.connect(trader1).sell(marketId(), bn(1));
    });

    it('trader1 received 900 snxUSD', async () => {
      assertBn.equal(
        await systems().USD.balanceOf(await trader1.getAddress()),
        initialTrader1Balance.add(bn(900)) // sell feed $900 price per eth
      );
    });

    it('withdrew 900 usd from MM', async () => {
      assertBn.equal(
        await systems().Core.getWithdrawableUsd(marketId()),
        withdrawableUsd.sub(bn(900))
      );
    });

    it('emits SynthSold event', async () => {
      await assertEvent(txn, `SynthSold(${marketId()}, ${bn(900)}, 0)`, systems().SpotMarket);
    });
  });

  describe('utilization rate fees', async () => {
    before(restore);

    before('set utilization fee to 100 bps', async () => {
      await systems().SpotMarket.connect(marketOwner).setMarketUtilizationFees(marketId(), bn(100));
    });

    before('sell 1 snxETH', async () => {
      await synth.connect(trader1).approve(systems().SpotMarket.address, bn(1));
      await systems().SpotMarket.connect(trader1).sell(marketId(), bn(1));
    });

    // no utilizaiton fees should apply to sell
    it('returns all USD without any fees', async () => {
      assertBn.equal(
        await systems().USD.balanceOf(await trader1.getAddress()),
        initialTrader1Balance.add(bn(900)) // sell feed $900 price per eth
      );
    });
  });

  describe('fixed fee', () => {
    before(restore);

    let withdrawableUsd: Ethers.BigNumber;
    let txn: Ethers.providers.TransactionResponse;
    before('set fixed fee to 100 bps', async () => {
      await systems().SpotMarket.connect(marketOwner).setAtomicFixedFee(marketId(), bn(100));
    });

    before('sell 1 snxETH', async () => {
      withdrawableUsd = await systems().Core.getWithdrawableUsd(marketId());
      await synth.connect(trader1).approve(systems().SpotMarket.address, bn(1));
      txn = await systems().SpotMarket.connect(trader1).sell(marketId(), bn(1));
    });

    // $9 fee, 1% fee
    it('trader1 has 891 usd', async () => {
      assertBn.equal(
        await systems().USD.balanceOf(await trader1.getAddress()),
        initialTrader1Balance.add(bn(891)) // sell feed $900 price per eth
      );
    });

    // no fee collector so everything gets deposited to MM
    it('withdrew 891 usd to MM', async () => {
      assertBn.equal(
        await systems().Core.getWithdrawableUsd(marketId()),
        withdrawableUsd.sub(bn(891))
      );
    });

    it('emits SynthSold event', async () => {
      await assertEvent(
        txn,
        `SynthSold(${marketId()}, ${bn(891)}, ${bn(9)})`,
        systems().SpotMarket
      );
    });

    describe('custom transactor fee', async () => {
      before('set transactor fee to 10 bps', async () => {
        await systems()
          .SpotMarket.connect(marketOwner)
          .setCustomTransactorFees(marketId(), trader2.getAddress(), bn(10));
      });

      before('sell 1 snxETH', async () => {
        await synth.connect(trader2).approve(systems().SpotMarket.address, bn(1));
        await systems().SpotMarket.connect(trader2).sell(marketId(), bn(1));
      });

      it('only charges custom transactor fees', async () => {
        assertBn.equal(
          await systems().USD.balanceOf(await trader2.getAddress()),
          initialTrader2Balance.add(bn(899.1)) // sell feed $900 price per eth
        );
      });
    });
  });

  describe('all fees', () => {
    before(restore);

    // 20 snxETH outstanding from initial trader purchases

    before('set fixed fee to 100 bps', async () => {
      await systems().SpotMarket.connect(marketOwner).setAtomicFixedFee(marketId(), bn(100));
    });

    before('set skew scale to 100 snxETH', async () => {
      await systems().SpotMarket.connect(marketOwner).setMarketSkewScale(marketId(), bn(100));
    });

    before('buy 5 snxETH', async () => {
      await synth.connect(trader1).approve(systems().SpotMarket.address, bn(5));
      await systems().SpotMarket.connect(trader1).sell(marketId(), bn(5));
    });

    it('trader1 gets 9.5 snxETH', async () => {
      // before fill value = 20 eth * 900 usd/eth = 18_000 usd
      // after fill value = 18_000 - 5 * 900 = 13_500 usd
      // -17.5% fee (average before/after fill 20 + 15 / 2)
      // 1% fixed fee
      // $900 eth price * 5 eth skew * 16.5% fee =
      assertBn.equal(
        await systems().USD.balanceOf(await trader1.getAddress()),
        initialTrader1Balance.add(bn(5242.5))
      );
    });
  });
  //   before(restore);

  //   before('set all fees', async () => {
  //     /*
  //         NOTE: very unlikely both utilization and skew fees would be set at the same time
  //         but we test that the fees are additive and is supported.
  //       */
  //     await systems().SpotMarket.connect(marketOwner).setAtomicFixedFee(marketId(), bn(100));
  //     await systems().SpotMarket.connect(marketOwner).setMarketUtilizationFees(marketId(), bn(100));
  //     await systems().SpotMarket.connect(marketOwner).setMarketSkewScale(marketId(), bn(1000));
  //   });

  //   before('traders buy snxETH', async () => {
  //     await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(90_000));
  //     await systems().USD.connect(trader2).approve(systems().SpotMarket.address, bn(25_000));

  //     await systems().SpotMarket.connect(trader1).buy(marketId(), bn(90_000)); // 90 eth
  //     await systems().SpotMarket.connect(trader2).buy(marketId(), bn(25_000)); // 25 eth
  //   });

  //   it('sent correct amounts of synth to trader 1', async () => {
  //     // fixed fee 1% + utilization fee 0% (under 100% utilization)
  //     //  + skew fee 4.5% (under 1000 eth skew) == 5.5% fee
  //     assertBn.equal(await synth.balanceOf(await trader1.getAddress()), bn(90 * 0.945));
  //   });

  //   it('sent correct amount of synth to trader 2', async () => {
  //     // current synth amount after fees from trader1 = 85.05 eth
  //     // total synth after trader2 buy = 110.05 eth
  //     // fixed fee = 1%
  //     // utilfee = 1.1005%  (percent above utilization)
  //     // skew fee = (85.05 + 110.05 / 2) = 9.755%
  //     // total fees = 11.8555%
  //     assertBn.equal(await synth.balanceOf(await trader2.getAddress()), bn(22.036125));
  //   });

  //   describe('custom transactor fees', () => {
  //     before('set trader1 atomic fee to 10 bps', async () => {
  //       await systems()
  //         .SpotMarket.connect(marketOwner)
  //         .setCustomTransactorFees(marketId(), trader1.getAddress(), bn(10));
  //     });

  //     let previousTrader1Balance: Ethers.BigNumber;
  //     before('trader1 buys again', async () => {
  //       previousTrader1Balance = await synth.balanceOf(await trader1.getAddress());
  //       await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(1000));
  //       await systems().SpotMarket.connect(trader1).buy(marketId(), bn(1000));
  //     });

  //     it('trader1 gets lower atomic fixed fee', async () => {
  //       // current synth amount from previous trades = 107.086125 eth
  //       // total synth after trader2 buy = 108.086125 eth
  //       // fixed fee = 0.1%
  //       // utilfee = 1.08086125%  (percent above utilization)
  //       // skew fee = 10.7586125%
  //       // total fees = 10.7586125% + 1.08086125% + 0.1% = 11.93947375%
  //       assertBn.equal(
  //         await synth.balanceOf(await trader1.getAddress()),
  //         previousTrader1Balance.add(bn(0.8806052625))
  //       );
  //     });
  //   });
  // });
});
