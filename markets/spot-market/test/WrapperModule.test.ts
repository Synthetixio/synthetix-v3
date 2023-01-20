import { ethers } from 'ethers';
import { wei } from '@synthetixio/wei';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { bootstrapTraders, bootstrapWithSynth } from './bootstrap';
import { SynthRouter } from '../generated/typechain';

const bn = (n: number) => wei(n).toBN();

describe.only('WrapperModule', () => {
  const { systems, signers, marketId } = bootstrapTraders(
    bootstrapWithSynth('Synthetic Ether', 'snxETH')
  );

  let marketOwner: ethers.Signer, trader1: ethers.Signer, trader2: ethers.Signer;
  let synth: SynthRouter;

  before('identify actors', async () => {
    [, , marketOwner, trader1, trader2] = signers();
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
    await assertRevert(systems().SpotMarket.wrap(25, 10000), 'InvalidMarket');
  });

  it('reverts when wrapper not set', async () => {
    await assertRevert(systems().SpotMarket.wrap(marketId(), 10000), 'InvalidCollateralType');
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
  });

  describe('wrap', () => {
    describe('without enough funds', () => {
      it('reverts', async () => {
        await assertRevert(
          systems().SpotMarket.connect(trader1).wrap(marketId(), bn(1_000_000)),
          'InsufficientFunds'
        );
      });
    });

    describe('when proper allowances are not set', () => {
      it('reverts', async () => {
        await assertRevert(
          systems().SpotMarket.connect(trader1).wrap(marketId(), bn(1_000)),
          'InsufficientAllowance'
        );
      });
    });

    describe('with proper funds and allowance', () => {
      before('set allowance', async () => {
        await systems()
          .CollateralMock.connect(trader1)
          .approve(systems().SpotMarket.address, bn(1));
      });

      let txn: ethers.providers.TransactionResponse, previousWithdrwableUsd: ethers.BigNumber;

      before('identify withdrawable usd', async () => {
        previousWithdrwableUsd = await systems().Core.getWithdrawableMarketUsd(marketId());
      });

      before('wrap using collateral', async () => {
        txn = await systems().SpotMarket.connect(trader1).wrap(marketId(), bn(1));
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
          previousWithdrwableUsd.add(bn(995.5))
        );
      });

      it('emits wrap event', async () => {
        await assertEvent(
          txn,
          `SynthWrapped(${marketId()}, ${bn(0.99)}, ${bn(9)}, ${bn(4.5)})`,
          systems().SpotMarket
        );
      });
    });
  });

  describe('unwrap', () => {
    describe('when not enough synth', () => {
      it('reverts', async () => {
        await assertRevert(
          systems().SpotMarket.connect(trader1).unwrap(marketId(), bn(1_000)),
          'InsufficientFunds'
        );
      });
    });

    describe('when proper allowances are not set', () => {
      it('reverts', async () => {
        await assertRevert(
          systems().SpotMarket.connect(trader1).unwrap(marketId(), bn(0.1)),
          'InsufficientAllowance'
        );
      });
    });

    describe('with proper synth funds and allowance', async () => {
      before('set allowance', async () => {
        await synth.connect(trader1).approve(systems().SpotMarket.address, bn(0.5));
      });

      let txn: ethers.providers.TransactionResponse,
        previousWithdrwableUsd: ethers.BigNumber,
        previousTrader1CollateralAmount: ethers.BigNumber,
        previousFeeCollectorUsdBalance: ethers.BigNumber,
        previousMarketCollateralAmount: ethers.BigNumber;

      before('identify previous balances', async () => {
        previousWithdrwableUsd = await systems().Core.getWithdrawableMarketUsd(marketId());
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

      before('unwrap synth', async () => {
        txn = await systems().SpotMarket.connect(trader1).unwrap(marketId(), bn(0.5));
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
          previousWithdrwableUsd.sub(bn(497.5).add(bn(1.125)))
        );
      });

      it('emits unwrap event', async () => {
        await assertEvent(
          txn,
          `SynthUnwrapped(${marketId()}, ${bn(0.4975)}, ${bn(2.25)}, ${bn(1.125)})`,
          systems().SpotMarket
        );
      });
    });
  });
});
