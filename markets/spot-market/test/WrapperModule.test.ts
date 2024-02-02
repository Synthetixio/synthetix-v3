import { ethers } from 'ethers';
import { wei } from '@synthetixio/wei';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { bootstrapTraders, bootstrapWithSynth } from './bootstrap';
import { SynthRouter } from './generated/typechain';
import assert from 'assert';

const bn = (n: number) => wei(n).toBN();

describe('WrapperModule', () => {
  const { systems, signers, marketId } = bootstrapTraders(
    bootstrapWithSynth('Synthetic Ether', 'snxETH')
  );

  let marketOwner: ethers.Signer, trader1: ethers.Signer;
  let synth: SynthRouter;

  before('identify actors', async () => {
    [, , marketOwner, trader1] = signers();
  });

  before('identify synth', async () => {
    const synthAddress = await systems().SpotMarket.getSynth(1);
    synth = systems().Synth(synthAddress);
  });

  before('set wrapper fees', async () => {
    await systems().SpotMarket.connect(marketOwner).setWrapperFees(marketId(), bn(0.01), bn(0.005));
  });

  before('set fee collector', async () => {
    await systems()
      .SpotMarket.connect(marketOwner)
      .setFeeCollector(marketId(), systems().FeeCollectorMock.address);
  });

  it('reverts when invalid market id', async () => {
    await assertRevert(systems().SpotMarket.wrap(25, 10000, 0), 'InvalidMarket');
  });

  it('reverts when wrapper not set', async () => {
    await assertRevert(systems().SpotMarket.wrap(marketId(), 10000, 0), 'InvalidCollateralType');
  });

  it('reverts when not a market owner tries updating wrapper', async () => {
    await assertRevert(
      systems().SpotMarket.setWrapper(marketId(), systems().CollateralMock.address, bn(1000)),
      'OnlyMarketOwner'
    );
  });

  describe('enable wrapper', () => {
    let txn: ethers.providers.TransactionResponse;
    before('enable wrapper', async () => {
      txn = await systems()
        .SpotMarket.connect(marketOwner)
        .setWrapper(marketId(), systems().CollateralMock.address, bn(500));
    });

    it('emits event', async () => {
      await assertEvent(
        txn,
        `WrapperSet(${marketId()}, "${systems().CollateralMock.address}", ${bn(500)})`,
        systems().SpotMarket
      );
    });

    it('can get wrapper info', async () => {
      const wrapperInfo = await systems().SpotMarket.getWrapper(marketId());
      assert.equal(wrapperInfo[0], systems().CollateralMock.address);
      assertBn.equal(wrapperInfo[1], bn(500));
    });
  });

  describe('wrap', () => {
    describe('when attempting to wrap above maxWrappableAmount', () => {
      before('set allowance', async () => {
        await systems()
          .CollateralMock.connect(trader1)
          .approve(systems().SpotMarket.address, bn(501));
      });

      it('reverts', async () => {
        await assertRevert(
          systems().SpotMarket.connect(trader1).wrap(marketId(), bn(501), 0),
          'WrapperExceedsMaxAmount'
        );
      });
    });

    describe('slippage protection', () => {
      it('reverts', async () => {
        // There is a fee set, so we don't expect the order to fill 1:1
        await assertRevert(
          systems().SpotMarket.connect(trader1).wrap(marketId(), bn(500), bn(500)),
          'InsufficientAmountReceived'
        );
      });
    });

    describe('when wrapping below maxWrappableAmount', () => {
      before('set allowance', async () => {
        await systems()
          .CollateralMock.connect(trader1)
          .approve(systems().SpotMarket.address, bn(1));
      });

      let txn: ethers.providers.TransactionResponse, previousWithdrawableUsd: ethers.BigNumber;

      before('identify withdrawable usd', async () => {
        previousWithdrawableUsd = await systems().Core.getWithdrawableMarketUsd(marketId());
      });

      before('wrap using collateral', async () => {
        txn = await systems().SpotMarket.connect(trader1).wrap(marketId(), bn(1), 0);
      });

      it('returns correct amount of synth to trader', async () => {
        assertBn.equal(
          await synth.balanceOf(await trader1.getAddress()),
          bn(1).sub(bn(0.01)) // 1 - 0.01% fee
        );
      });

      it('collected half fees to fee collector', async () => {
        assertBn.equal(
          await systems().USD.balanceOf(systems().FeeCollectorMock.address),
          bn(4.5) // assuming price of 1 eth = $900 (sell feed id)
        );
      });

      it('deposited correct amount into market collateral', async () => {
        assertBn.equal(
          await systems().Core.getMarketCollateralAmount(
            marketId(),
            systems().CollateralMock.address
          ),
          bn(1)
        );
      });

      it('properly reflects withdrawable usd', async () => {
        // collateral price in core = $1000/eth
        // fees withdrawn from core = $9
        // fees collected by fee collector = $4.5
        // fees re-deposited into core = $4.5
        // withdrawable usd = $1000 - $9 + $4.5 = $995.5
        assertBn.equal(
          await systems().Core.getWithdrawableMarketUsd(marketId()),
          previousWithdrawableUsd.add(bn(995.5))
        );
      });

      it('emits wrap event', async () => {
        await assertEvent(
          txn,
          `SynthWrapped(${marketId()}, ${bn(0.99)}, [0, 0, 0, ${bn(9)}], ${bn(4.5)})`,
          systems().SpotMarket
        );
      });
    });

    describe('does not allow you to update collateral type with oustanding collateral deposited', () => {
      it('reverts on update with different collateral type', async () => {
        await assertRevert(
          systems()
            .SpotMarket.connect(marketOwner)
            // use random address
            .setWrapper(marketId(), systems().FeeCollectorMock.address, bn(500)),
          'InvalidCollateralType'
        );
      });
    });
  });

  describe('unwrap', () => {
    before('set allowance', async () => {
      await synth.connect(trader1).approve(systems().SpotMarket.address, bn(0.5));
    });

    it('reverts', async () => {
      // There is a fee set, so we don't expect the order to fill 1:1
      await assertRevert(
        systems().SpotMarket.connect(trader1).unwrap(marketId(), bn(0.5), bn(0.5)),
        'InsufficientAmountReceived'
      );
    });

    let txn: ethers.providers.TransactionResponse,
      previousWithdrawableUsd: ethers.BigNumber,
      previousTrader1CollateralAmount: ethers.BigNumber,
      previousFeeCollectorUsdBalance: ethers.BigNumber,
      previousMarketCollateralAmount: ethers.BigNumber;

    before('identify previous balances', async () => {
      previousWithdrawableUsd = await systems().Core.getWithdrawableMarketUsd(marketId());
      previousTrader1CollateralAmount = await systems().CollateralMock.balanceOf(
        await trader1.getAddress()
      );
      previousFeeCollectorUsdBalance = await systems().USD.balanceOf(
        systems().FeeCollectorMock.address
      );
      previousMarketCollateralAmount = await systems().Core.getMarketCollateralAmount(
        marketId(),
        systems().CollateralMock.address
      );
    });

    it('unwrap synth', async () => {
      txn = await systems().SpotMarket.connect(trader1).unwrap(marketId(), bn(0.5), 0);
    });

    it('returns correct amount of collateral to trader', async () => {
      assertBn.equal(
        await systems().CollateralMock.balanceOf(await trader1.getAddress()),
        previousTrader1CollateralAmount.add(bn(0.4975)) // 0.5 - 0.5% fee
      );
    });

    it('collected half fees to fee collector', async () => {
      // 1 eth = $900
      // 0.5 eth = $450
      // .5% fee = $2.25
      // 2.25 / 2 = 1.125 (half goes to fee collector)
      assertBn.equal(
        await systems().USD.balanceOf(systems().FeeCollectorMock.address),
        previousFeeCollectorUsdBalance.add(bn(1.125))
      );
    });

    it('withdrew correct amount from market collateral', async () => {
      assertBn.equal(
        await systems().Core.getMarketCollateralAmount(
          marketId(),
          systems().CollateralMock.address
        ),
        previousMarketCollateralAmount.sub(bn(0.4975))
      );
    });

    it('properly reflects withdrawable usd', async () => {
      // fees withdrawn from core = $2.25
      // fees collected by fee collector = $1.125
      // fees re-deposited into core = $1.125
      // withdrew 0.4975 ETH to return to user = $497.5
      assertBn.equal(
        await systems().Core.getWithdrawableMarketUsd(marketId()),
        previousWithdrawableUsd.sub(bn(497.5).add(bn(1.125)))
      );
    });

    it('emits unwrap event', async () => {
      await assertEvent(
        txn,
        `SynthUnwrapped(${marketId()}, ${bn(0.4975)}, [0, 0, 0, ${bn(2.25)}], ${bn(1.125)})`,
        systems().SpotMarket
      );
    });
  });

  describe('negative fees', () => {
    before('set negative fee for unwrap', async () => {
      await systems()
        .SpotMarket.connect(marketOwner)
        .setWrapperFees(marketId(), bn(0.01), bn(-0.01));
    });

    before('trader1 wraps 1 eth', async () => {
      await systems().CollateralMock.connect(trader1).approve(systems().SpotMarket.address, bn(1));
      await systems().SpotMarket.connect(trader1).wrap(marketId(), bn(1), 0);
    });

    let previousTrader1CollateralAmount: ethers.BigNumber,
      previousFeeCollectorBalance: ethers.BigNumber;

    before('identify previous values', async () => {
      previousTrader1CollateralAmount = await systems().CollateralMock.balanceOf(
        await trader1.getAddress()
      );
      previousFeeCollectorBalance = await systems().USD.balanceOf(
        systems().FeeCollectorMock.address
      );
    });

    before('trader1 unwraps 0.5 eth', async () => {
      await synth.connect(trader1).approve(systems().SpotMarket.address, bn(0.5));
      await systems().SpotMarket.connect(trader1).unwrap(marketId(), bn(0.5), 0);
    });

    it('trader1 should receive more collateral back', async () => {
      assertBn.equal(
        await systems().CollateralMock.balanceOf(await trader1.getAddress()),
        previousTrader1CollateralAmount.add(bn(0.505))
      );
    });

    it('did not change fee collector balance', async () => {
      assertBn.equal(
        await systems().USD.balanceOf(systems().FeeCollectorMock.address),
        previousFeeCollectorBalance
      );
    });
  });

  describe('setWrapperFees guardrails', () => {
    it('cannot be set such that the sum of the fees is negative', async () => {
      await assertRevert(
        systems().SpotMarket.connect(marketOwner).setWrapperFees(marketId(), bn(0.2), bn(-0.3)),
        'InvalidWrapperFees'
      );
      await assertRevert(
        systems().SpotMarket.connect(marketOwner).setWrapperFees(marketId(), bn(-0.6), bn(0.5)),
        'InvalidWrapperFees'
      );
      await assertRevert(
        systems().SpotMarket.connect(marketOwner).setWrapperFees(marketId(), bn(-0.1), bn(-0.1)),
        'InvalidWrapperFees'
      );
    });
  });
});
