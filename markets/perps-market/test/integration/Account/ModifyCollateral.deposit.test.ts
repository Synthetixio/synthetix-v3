import { ethers } from 'ethers';
import { bn, bootstrapMarkets } from '../bootstrap';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import { deepEqual } from 'assert/strict';

describe('ModifyCollateral Deposit', () => {
  const accountIds = [10, 20];
  const oneBTC = bn(1);
  const marginAmount = bn(10_000);

  const { systems, owner, superMarketId, synthMarkets, trader1 } = bootstrapMarkets({
    synthMarkets: [
      {
        name: 'Bitcoin',
        token: 'snxBTC',
        buyPrice: bn(10_000),
        sellPrice: bn(10_000),
      },
      {
        name: 'Ether',
        token: 'snxETH',
        buyPrice: bn(1_000),
        sellPrice: bn(1_000),
      },
    ],
    perpsMarkets: [],
    traderAccountIds: accountIds,
  });
  let synthBTCMarketId: ethers.BigNumber;
  let synthETHMarketId: ethers.BigNumber;

  before('identify actors', () => {
    synthBTCMarketId = synthMarkets()[0].marketId(); // 2
    synthETHMarketId = synthMarkets()[1].marketId(); // 3
  });

  describe('deposit by modifyCollateral()', () => {
    let spotBalanceBefore: ethers.BigNumber;
    let modifyCollateralTxn: ethers.providers.TransactionResponse;

    before('owner sets limits to max', async () => {
      await systems()
        .PerpsMarket.connect(owner())
        .setCollateralConfiguration(synthBTCMarketId, ethers.constants.MaxUint256, 0, 0, 0);
    });

    before('trader1 buys 1 snxBTC', async () => {
      await systems()
        .SpotMarket.connect(trader1())
        .buy(synthBTCMarketId, marginAmount, oneBTC, ethers.constants.AddressZero);
    });

    before('trader1 buys 1 snxETH', async () => {
      await systems()
        .SpotMarket.connect(trader1())
        .buy(synthETHMarketId, marginAmount, oneBTC, ethers.constants.AddressZero);
    });

    before('record balances', async () => {
      spotBalanceBefore = await synthMarkets()[0]
        .synth()
        .connect(trader1())
        .balanceOf(await trader1().getAddress());
    });

    before('trader1 approves the perps market', async () => {
      await synthMarkets()[0]
        .synth()
        .connect(trader1())
        .approve(systems().PerpsMarket.address, oneBTC);

      await synthMarkets()[1]
        .synth()
        .connect(trader1())
        .approve(systems().PerpsMarket.address, oneBTC);
    });

    before('trader1 adds collateral', async () => {
      modifyCollateralTxn = await systems()
        .PerpsMarket.connect(trader1())
        .modifyCollateral(accountIds[0], synthBTCMarketId, oneBTC);
    });

    it('properly reflects the total collateral value', async () => {
      const totalValue = await systems().PerpsMarket.totalCollateralValue(accountIds[0]);
      assertBn.equal(totalValue, marginAmount);
    });

    it('properly reflects the total account open interest', async () => {
      const totalOpenInterest = await systems().PerpsMarket.totalAccountOpenInterest(accountIds[0]);
      assertBn.equal(totalOpenInterest, 0); // only deposited - did not open a position
    });

    it('properly reflects trader1 spot balance', async () => {
      const spotBalanceAfter = await synthMarkets()[0]
        .synth()
        .connect(trader1())
        .balanceOf(await trader1().getAddress());
      assertBn.equal(spotBalanceAfter, spotBalanceBefore.sub(oneBTC));
    });

    it('properly reflects core system collateral balance', async () => {
      const btcCollateralValue = await systems().Core.getMarketCollateralAmount(
        superMarketId(),
        synthMarkets()[0].synthAddress()
      );

      assertBn.equal(btcCollateralValue, oneBTC);
    });

    it('emits correct event with the expected values', async () => {
      await assertEvent(
        modifyCollateralTxn,
        `CollateralModified(${accountIds[0]}, ${synthBTCMarketId}, ${bn(
          1
        )}, "${await trader1().getAddress()}"`,
        systems().PerpsMarket
      );
    });

    it('returns the correct amount when calling getCollateralAmount', async () => {
      const collateralBalance = await systems().PerpsMarket.getCollateralAmount(
        accountIds[0],
        synthBTCMarketId
      );
      assertBn.equal(collateralBalance, bn(1));
    });

    it('returns the correct list of active collaterals', async () => {
      const activeCollaterals = await systems().PerpsMarket.getAccountCollateralIds(accountIds[0]);

      deepEqual([synthBTCMarketId], activeCollaterals);
    });

    it('trader1 adds snxETH collateral', async () => {
      await systems()
        .PerpsMarket.connect(trader1())
        .modifyCollateral(accountIds[0], synthETHMarketId, oneBTC);
    });

    it('returns the correct list of active collaterals', async () => {
      const activeCollaterals = await systems().PerpsMarket.getAccountCollateralIds(accountIds[0]);

      deepEqual([synthBTCMarketId, synthETHMarketId], activeCollaterals);
    });
  });
});
