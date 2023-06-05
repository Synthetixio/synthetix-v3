import { ethers } from 'ethers';
import { bootstrapMarkets } from '../bootstrap';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import { wei } from '@synthetixio/wei';

describe('ModifyCollateral Withdraw', () => {
  const accountIds = [10, 20];
  const oneBTC = wei(1);
  const marginAmount = wei(10_000);
  const depositAmount = wei(1);
  const withdrawAmount = wei(0.1);
  const BTC_PRICE = wei(10_000);

  const { systems, owner, synthMarkets, trader1 } = bootstrapMarkets({
    synthMarkets: [
      {
        name: 'Bitcoin',
        token: 'snxBTC',
        buyPrice: BTC_PRICE.toBN(),
        sellPrice: BTC_PRICE.toBN(),
      },
    ],
    perpsMarkets: [],
    traderAccountIds: accountIds,
  });
  let synthBTCMarketId: ethers.BigNumber;

  before('identify actors', () => {
    synthBTCMarketId = synthMarkets()[0].marketId();
  });

  describe('withdraw by modifyCollateral()', async () => {
    let spotBalanceBefore: ethers.BigNumber;
    let perpsBalanceBefore: ethers.BigNumber;
    let modifyCollateralWithdrawTxn: ethers.providers.TransactionResponse;

    before('owner sets limits to max', async () => {
      await systems()
        .PerpsMarket.connect(owner())
        .setMaxCollateralAmount(synthBTCMarketId, ethers.constants.MaxUint256);
    });

    before('trader1 buys 1 snxBTC', async () => {
      await systems()
        .SpotMarket.connect(trader1())
        .buy(synthBTCMarketId, marginAmount.toBN(), oneBTC.toBN(), ethers.constants.AddressZero);
    });

    before('record balances', async () => {
      spotBalanceBefore = await synthMarkets()[0]
        .synth()
        .connect(trader1())
        .balanceOf(await trader1().getAddress());

      perpsBalanceBefore = await synthMarkets()[0]
        .synth()
        .connect(trader1())
        .balanceOf(systems().PerpsMarket.address);
    });

    before('trader1 approves the perps market', async () => {
      await synthMarkets()[0]
        .synth()
        .connect(trader1())
        .approve(systems().PerpsMarket.address, depositAmount.toBN());
    });

    before('trader1 deposits collateral', async () => {
      await systems()
        .PerpsMarket.connect(trader1())
        .modifyCollateral(accountIds[0], synthBTCMarketId, depositAmount.toBN());
    });
    before('trader1 withdraws some collateral', async () => {
      modifyCollateralWithdrawTxn = await systems()
        .PerpsMarket.connect(trader1())
        .modifyCollateral(accountIds[0], synthBTCMarketId, withdrawAmount.mul(-1).toBN());
    });

    it('properly reflects the total collateral value', async () => {
      const totalValue = await systems().PerpsMarket.totalCollateralValue(accountIds[0]);
      assertBn.equal(totalValue, depositAmount.sub(withdrawAmount).mul(BTC_PRICE).toBN());
    });

    it('properly reflects trader1 spot balance', async () => {
      const spotBalanceAfter = await synthMarkets()[0]
        .synth()
        .connect(trader1())
        .balanceOf(await trader1().getAddress());
      assertBn.equal(
        spotBalanceAfter,
        wei(spotBalanceBefore).sub(depositAmount).add(withdrawAmount).toBN()
      );
    });

    it('properly reflects the perps market balance', async () => {
      const perpsBalanceAfter = await synthMarkets()[0]
        .synth()
        .connect(trader1())
        .balanceOf(systems().PerpsMarket.address);
      assertBn.equal(
        perpsBalanceAfter,
        wei(perpsBalanceBefore).add(depositAmount).sub(withdrawAmount).toBN()
      );
    });

    it('emits correct event with the expected values', async () => {
      await assertEvent(
        modifyCollateralWithdrawTxn,
        `CollateralModified(${accountIds[0]}, ${synthBTCMarketId}, ${withdrawAmount
          .mul(-1)
          .toBN()}, "${await trader1().getAddress()}"`,
        systems().PerpsMarket
      );
    });
  });
});
