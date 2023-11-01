import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { ethers as Ethers } from 'ethers';
import { SynthRouter } from './generated/typechain';
import { bn, bootstrapTraders, bootstrapWithSynth } from './bootstrap';
import { generateExternalNode } from '@synthetixio/oracle-manager/test/common';
import { STRICT_PRICE_TOLERANCE } from './common';

describe('Atomic Order Module sell()', () => {
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
    await systems()
      .SpotMarket.connect(trader1)
      .buy(marketId(), bn(10_000), bn(10), Ethers.constants.AddressZero);
    await systems().USD.connect(trader2).approve(systems().SpotMarket.address, bn(10_000));
    await systems()
      .SpotMarket.connect(trader2)
      .buy(marketId(), bn(10_000), bn(10), Ethers.constants.AddressZero);
  });

  const restore = snapshotCheckpoint(provider);

  before('identify initial trader balances', async () => {
    initialTrader1Balance = await systems().USD.balanceOf(await trader1.getAddress());
    initialTrader2Balance = await systems().USD.balanceOf(await trader2.getAddress());
  });

  describe('slippage', () => {
    let withdrawableUsd: Ethers.BigNumber;
    let traderBalance: Ethers.BigNumber;
    it('reverts sell when minAmountReceived condition is not meet', async () => {
      withdrawableUsd = await systems().Core.getWithdrawableMarketUsd(marketId());
      traderBalance = await synth.balanceOf(await trader1.getAddress());
      await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(1000));

      await assertRevert(
        systems()
          .SpotMarket.connect(trader1)
          .sell(marketId(), bn(1), bn(1000), Ethers.constants.AddressZero),
        `InsufficientAmountReceived("${bn(1000)}", "${bn(900)}")`
      );
    });

    it('trader1 snxUSD balance has not changed', async () => {
      assertBn.equal(await synth.balanceOf(await trader1.getAddress()), traderBalance);
    });

    it('market withdrawable Usd has not change', async () => {
      assertBn.equal(await systems().Core.getWithdrawableMarketUsd(marketId()), withdrawableUsd);
    });
  });

  describe('no fees', () => {
    let withdrawableUsd: Ethers.BigNumber, txn: Ethers.providers.TransactionResponse;
    before('sell 1 snxETH', async () => {
      withdrawableUsd = await systems().Core.getWithdrawableMarketUsd(marketId());
      await synth.connect(trader1).approve(systems().SpotMarket.address, bn(1));
      txn = await systems()
        .SpotMarket.connect(trader1)
        .sell(marketId(), bn(1), bn(900), Ethers.constants.AddressZero);
    });

    it('trader1 received 900 snxUSD', async () => {
      assertBn.equal(
        await systems().USD.balanceOf(await trader1.getAddress()),
        initialTrader1Balance.add(bn(900)) // sell feed $900 price per eth
      );
    });

    it('withdrew 900 usd from MM', async () => {
      assertBn.equal(
        await systems().Core.getWithdrawableMarketUsd(marketId()),
        withdrawableUsd.sub(bn(900))
      );
    });

    it('emits SynthSold event', async () => {
      await assertEvent(
        txn,
        `SynthSold(${marketId()}, ${bn(900)}, [0, 0, 0, 0], 0, "${
          Ethers.constants.AddressZero
        }", ${bn(900)})`,
        systems().SpotMarket
      );
    });
  });

  describe('utilization rate fees', async () => {
    before(restore);

    before('set utilization fee to 1%', async () => {
      await systems()
        .SpotMarket.connect(marketOwner)
        .setMarketUtilizationFees(marketId(), bn(0.01));
    });

    before('sell 1 snxETH', async () => {
      await synth.connect(trader1).approve(systems().SpotMarket.address, bn(1));
      await systems()
        .SpotMarket.connect(trader1)
        .sell(marketId(), bn(1), bn(900), Ethers.constants.AddressZero);
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
    before('set fixed fee to 1%', async () => {
      await systems().SpotMarket.connect(marketOwner).setAtomicFixedFee(marketId(), bn(0.01));
    });

    before('sell 1 snxETH', async () => {
      withdrawableUsd = await systems().Core.getWithdrawableMarketUsd(marketId());
      await synth.connect(trader1).approve(systems().SpotMarket.address, bn(1));
      txn = await systems()
        .SpotMarket.connect(trader1)
        .sell(marketId(), bn(1), bn(891), Ethers.constants.AddressZero);
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
        await systems().Core.getWithdrawableMarketUsd(marketId()),
        withdrawableUsd.sub(bn(891))
      );
    });

    it('emits SynthSold event', async () => {
      await assertEvent(
        txn,
        `SynthSold(${marketId()}, ${bn(891)}, [${bn(9)}, 0, 0, 0], 0, "${
          Ethers.constants.AddressZero
        }", ${bn(900)})`,
        systems().SpotMarket
      );
    });

    describe('custom transactor fee', async () => {
      before('set transactor fee to 0.1%', async () => {
        await systems()
          .SpotMarket.connect(marketOwner)
          .setCustomTransactorFees(marketId(), trader2.getAddress(), bn(0.001));
      });

      before('sell 1 snxETH', async () => {
        await synth.connect(trader2).approve(systems().SpotMarket.address, bn(1));
        await systems()
          .SpotMarket.connect(trader2)
          .sell(marketId(), bn(1), bn(899.1), Ethers.constants.AddressZero);
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

    before('set fixed fee to 1%', async () => {
      await systems().SpotMarket.connect(marketOwner).setAtomicFixedFee(marketId(), bn(0.01));
    });

    before('set skew scale to 100 snxETH', async () => {
      await systems().SpotMarket.connect(marketOwner).setMarketSkewScale(marketId(), bn(100));
    });

    before('buy 5 snxETH', async () => {
      await synth.connect(trader1).approve(systems().SpotMarket.address, bn(5));
      await systems()
        .SpotMarket.connect(trader1)
        .sell(marketId(), bn(5), bn(5235.73875), Ethers.constants.AddressZero);
    });

    it('trader1 gets extra snxUSD back for selling', async () => {
      assertBn.equal(
        await systems().USD.balanceOf(await trader1.getAddress()),
        initialTrader1Balance.add(bn(5235.73875))
      );
    });
  });

  describe('price protection guardrails', () => {
    before(restore);

    before('set sell price higher than buy price', async () => {
      const nodeId100 = await generateExternalNode(systems().OracleManager, 100, 10);
      const nodeId200 = await generateExternalNode(systems().OracleManager, 200, 10);

      await systems()
        .SpotMarket.connect(marketOwner)
        .updatePriceData(marketId(), nodeId100, nodeId200, STRICT_PRICE_TOLERANCE);
    });

    it('reverts sellExactIn', async () => {
      await synth.connect(trader1).approve(systems().SpotMarket.address, bn(1000));
      await assertRevert(
        systems()
          .SpotMarket.connect(trader1)
          .sellExactIn(marketId(), bn(1), 0, Ethers.constants.AddressZero),
        'InvalidPrices'
      );
    });

    it('reverts sellExactOut', async () => {
      await synth.connect(trader1).approve(systems().SpotMarket.address, bn(1000));
      await assertRevert(
        systems()
          .SpotMarket.connect(trader1)
          .sellExactOut(marketId(), 1000, bn(1000), Ethers.constants.AddressZero),
        'InvalidPrices'
      );
    });
  });
});
