import { ethers as Ethers } from 'ethers';
import { bn, bootstrapTraders, bootstrapWithSynth } from './bootstrap';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { SynthRouter } from './generated/typechain';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import { generateExternalNode } from '@synthetixio/oracle-manager/test/common';
import { STRICT_PRICE_TOLERANCE } from './common';

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
    await assertRevert(
      systems().SpotMarket.buyExactIn(25, 10000, 10000, Ethers.constants.AddressZero),
      'InvalidMarket'
    );
  });

  describe('slippage', () => {
    let withdrawableUsd: Ethers.BigNumber;
    it('reverts buy when minAmountReceived condition is not meet', async () => {
      withdrawableUsd = await systems().Core.getWithdrawableMarketUsd(marketId());
      await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(1000));

      await assertRevert(
        systems()
          .SpotMarket.connect(trader1)
          .buy(marketId(), bn(1000), bn(10), Ethers.constants.AddressZero),
        `InsufficientAmountReceived("${bn(10)}", "${bn(1)}")`
      );
    });

    it('trader1 has 0 snxETH', async () => {
      assertBn.equal(await synth.balanceOf(await trader1.getAddress()), bn(0));
    });

    it('market withdrawable Usd has not change', async () => {
      assertBn.equal(await systems().Core.getWithdrawableMarketUsd(marketId()), withdrawableUsd);
    });
  });

  describe('no fees', () => {
    let withdrawableUsd: Ethers.BigNumber;
    let txn: Ethers.providers.TransactionResponse;
    before('buy 1 snxETH', async () => {
      withdrawableUsd = await systems().Core.getWithdrawableMarketUsd(marketId());
      await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(1000));
      txn = await systems()
        .SpotMarket.connect(trader1)
        .buy(marketId(), bn(1000), bn(1), Ethers.constants.AddressZero);
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
      await assertEvent(
        txn,
        `SynthBought(${marketId()}, ${bn(1)}, [0, 0, 0, 0], 0, "${
          Ethers.constants.AddressZero
        }", ${bn(1000)})`,
        systems().SpotMarket
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

    before('buy 1 snxETH', async () => {
      withdrawableUsd = await systems().Core.getWithdrawableMarketUsd(marketId());
      await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(1000));
      txn = await systems()
        .SpotMarket.connect(trader1)
        .buy(marketId(), bn(1000), bn(0.99), Ethers.constants.AddressZero);
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
        `SynthBought(${marketId()}, ${bn(0.99)}, [${bn(10)}, 0, 0, 0], 0, "${
          Ethers.constants.AddressZero
        }", ${bn(1000)})`,
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
      await systems()
        .SpotMarket.connect(trader1)
        .buy(marketId(), bn(50_000), bn(50), Ethers.constants.AddressZero);
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
        await systems()
          .SpotMarket.connect(trader2)
          .buy(marketId(), bn(100_000), bn(97.5), Ethers.constants.AddressZero);
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
        await systems()
          .SpotMarket.connect(trader1)
          .buy(marketId(), bn(10_000), bn(9.5), Ethers.constants.AddressZero);
      });

      it('trader1 gets 9.5 snxETH', async () => {
        assertBn.near(await synth.balanceOf(await trader1.getAddress()), bn(9.54451), bn(0.00001));
      });
    });

    describe('next trader buy', () => {
      before('buy 10 more snxETH', async () => {
        await systems().USD.connect(trader2).approve(systems().SpotMarket.address, bn(10_000));
        await systems()
          .SpotMarket.connect(trader2)
          .buy(marketId(), bn(10_000), bn(8.55), Ethers.constants.AddressZero);
      });

      it('trader2 gets 8.55 snxETH', async () => {
        assertBn.near(await synth.balanceOf(await trader2.getAddress()), bn(8.777084), bn(0.00001));
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
      txn = await systems()
        .SpotMarket.connect(trader1)
        .buy(marketId(), bn(100_000), bn(99), Ethers.constants.AddressZero); // 90 eth
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
        `SynthBought(${marketId()}, ${bn(99)}, [${expectedFee}, 0, 0, 0], ${expectedFee.div(2)}, "${
          Ethers.constants.AddressZero
        }", ${bn(1000)})`,
        systems().SpotMarket
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

    it('reverts buyExactIn', async () => {
      await systems().USD.connect(trader1).approve(systems().SpotMarket.address, 100);
      await assertRevert(
        systems()
          .SpotMarket.connect(trader1)
          .buyExactIn(marketId(), 100, 0, Ethers.constants.AddressZero),
        'InvalidPrices'
      );
    });

    it('reverts buyExactOut', async () => {
      await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(400));
      await assertRevert(
        systems()
          .SpotMarket.connect(trader1)
          .buyExactOut(marketId(), bn(100), 10000, Ethers.constants.AddressZero),
        'InvalidPrices'
      );
    });
  });
});
