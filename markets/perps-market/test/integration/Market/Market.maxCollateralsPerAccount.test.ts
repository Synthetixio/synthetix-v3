import { bn, bootstrapMarkets } from '../bootstrap';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { BigNumber, ethers } from 'ethers';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';

describe('Markets - Max Collaterals per account', () => {
  const traderAccountIds = [2];
  const _MARKET_PRICE = bn(100);
  const _UNLIMMITED = bn(100);
  const { systems, synthMarkets, provider, trader1, owner } = bootstrapMarkets({
    synthMarkets: [
      {
        name: 'Collateral1',
        token: 'snxCL1',
        buyPrice: _MARKET_PRICE,
        sellPrice: _MARKET_PRICE,
      },
      {
        name: 'Collateral2',
        token: 'snxCL2',
        buyPrice: _MARKET_PRICE,
        sellPrice: _MARKET_PRICE,
      },
    ],
    perpsMarkets: [
      {
        requestedMarketId: bn(25),
        name: 'Market1',
        token: 'snxMK1',
        price: _MARKET_PRICE,
        lockedOiRatioD18: bn(0.01),
      },
    ],
    traderAccountIds,
  });

  let market1Id: BigNumber, market2Id: BigNumber;
  before('identify actors', async () => {
    market1Id = synthMarkets()[0].marketId();
    market2Id = synthMarkets()[1].marketId();
  });

  before('ensure account has enough balance of synths and market is approved', async () => {
    const usdAmount = _MARKET_PRICE.mul(100);
    const minAmountReceived = bn(100);
    const referrer = ethers.constants.AddressZero;
    await systems()
      .SpotMarket.connect(trader1())
      .buy(market1Id, usdAmount, minAmountReceived, referrer);
    await synthMarkets()[0]
      .synth()
      .connect(trader1())
      .approve(systems().PerpsMarket.address, _UNLIMMITED);

    await systems()
      .SpotMarket.connect(trader1())
      .buy(market2Id, usdAmount, minAmountReceived, referrer);
    await synthMarkets()[1]
      .synth()
      .connect(trader1())
      .approve(systems().PerpsMarket.address, _UNLIMMITED);
  });

  before('ensure max collaterals is set to 0', async () => {
    await systems().PerpsMarket.connect(owner()).setPerAccountCaps(_UNLIMMITED, 0);
  });

  const restore = snapshotCheckpoint(provider);

  it('Collaterals: reverts if attempting to add collateral and is set to zero', async () => {
    await assertRevert(
      systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(10)),
      'MaxCollateralsPerAccountReached("0")'
    );
  });

  describe('Collaterals: when max collaterals per account is 1', () => {
    before(restore);

    before('set max collaterals per account', async () => {
      await systems().PerpsMarket.connect(owner()).setPerAccountCaps(_UNLIMMITED, 1);
    });

    it('should be able to add collateral', async () => {
      await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(10));
    });

    it('should revert when attempting to add a 2nd collateral', async () => {
      await assertRevert(
        systems().PerpsMarket.connect(trader1()).modifyCollateral(2, market1Id, bn(10)),
        'MaxCollateralsPerAccountReached("1")'
      );
    });

    it('can increase and decrease margin size for first collateral', async () => {
      await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(+1));
      await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(-1));
    });
  });

  describe('Collaterals: when max collaterals per account is unlimmited', () => {
    before(restore);

    before('set max collaterals per account', async () => {
      await systems().PerpsMarket.connect(owner()).setPerAccountCaps(_UNLIMMITED, _UNLIMMITED);
    });

    it('should be able to add more than one collateral type (two)', async () => {
      await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(10));

      await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, market1Id, bn(10));
    });

    describe('when reducing the max collaterals per account', () => {
      before('reduce max collaterals per account', async () => {
        await systems().PerpsMarket.connect(owner()).setPerAccountCaps(_UNLIMMITED, 2);
      });

      it('should revert when attempting to add a 3rd collateral', async () => {
        await assertRevert(
          systems().PerpsMarket.connect(trader1()).modifyCollateral(2, market2Id, bn(10)),
          'MaxCollateralsPerAccountReached("2")'
        );
      });

      it('should allow a new collateral if another is depleted', async () => {
        await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(-10));
        await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, market2Id, bn(10));
      });
    });
  });
});
