import { PerpsMarket, bn, bootstrapMarkets } from '../bootstrap';
import { OpenPositionData, depositCollateral, openPosition } from '../helpers';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';

describe('Markets - Max positions per account', () => {
  const traderAccountIds = [2];
  const _MARKET_PRICE = bn(100);
  const _UNLIMMITED = bn(100);
  const { systems, perpsMarkets, provider, trader1, owner } = bootstrapMarkets({
    synthMarkets: [],
    perpsMarkets: [
      {
        requestedMarketId: bn(25),
        name: 'Market1',
        token: 'snxMK1',
        price: _MARKET_PRICE,
        lockedOiRatioD18: bn(0.01),
      },
      {
        requestedMarketId: bn(26),
        name: 'Market2',
        token: 'snxMK2',
        price: _MARKET_PRICE,
        lockedOiRatioD18: bn(0.02),
      },
      {
        requestedMarketId: bn(27),
        name: 'Market3',
        token: 'snxMK3',
        price: _MARKET_PRICE,
        lockedOiRatioD18: bn(0.02),
      },
    ],
    traderAccountIds,
  });

  let market1: PerpsMarket, market2: PerpsMarket, market3: PerpsMarket;

  before('identify actors', async () => {
    market1 = perpsMarkets()[0];
    market2 = perpsMarkets()[1];
    market3 = perpsMarkets()[2];
  });

  before('ensure account has enough collateral', async () => {
    await depositCollateral({
      systems,
      trader: trader1,
      accountId: () => 2,
      collaterals: [
        {
          snxUSDAmount: () => bn(10_000),
        },
      ],
    });
  });

  let commonOpenPositionProps: Pick<
    OpenPositionData,
    'systems' | 'provider' | 'trader' | 'accountId' | 'keeper' | 'settlementStrategyId' | 'price'
  >;

  before('set common open position props', async () => {
    commonOpenPositionProps = {
      systems,
      provider,
      trader: trader1(),
      accountId: 2,
      keeper: trader1(),
      settlementStrategyId: market1.strategyId(),
      price: _MARKET_PRICE,
    };
  });

  before('ensure max positions is set to 0', async () => {
    await systems().PerpsMarket.connect(owner()).setPerAccountCaps(0, _UNLIMMITED);
  });

  const restore = snapshotCheckpoint(provider);

  it('Positions: reverts if attempting to open a position and limit is set to zero', async () => {
    await assertRevert(
      openPosition({
        ...commonOpenPositionProps,
        sizeDelta: bn(10),
        marketId: market1.marketId(),
      }),
      'MaxPositionsPerAccountReached("0")'
    );
  });

  describe('Positions: when max positions per account is 1', () => {
    before(restore);

    before('set max positions per account', async () => {
      await systems().PerpsMarket.connect(owner()).setPerAccountCaps(1, _UNLIMMITED);
    });

    it('should be able to open a position', async () => {
      await openPosition({
        ...commonOpenPositionProps,
        marketId: market1.marketId(),
        sizeDelta: bn(10),
      });
    });

    it('should revert when attempting to open a 2nd position', async () => {
      await assertRevert(
        openPosition({
          ...commonOpenPositionProps,
          marketId: market2.marketId(),
          sizeDelta: bn(10),
        }),
        'MaxPositionsPerAccountReached("1")'
      );
    });
    it('can increase and decrease existing positon size', async () => {
      await openPosition({
        ...commonOpenPositionProps,
        marketId: market1.marketId(),
        sizeDelta: bn(20),
      });

      await openPosition({
        ...commonOpenPositionProps,
        marketId: market1.marketId(),
        sizeDelta: bn(-20),
      });
    });
  });

  describe('Positions: when max positions per account is unlimmited', () => {
    before(restore);

    before('set max positions per account', async () => {
      await systems().PerpsMarket.connect(owner()).setPerAccountCaps(_UNLIMMITED, _UNLIMMITED);
    });

    it('should be able to open more than one position position', async () => {
      await openPosition({
        ...commonOpenPositionProps,
        marketId: market1.marketId(),
        sizeDelta: bn(10),
      });

      await openPosition({
        ...commonOpenPositionProps,
        marketId: market2.marketId(),
        sizeDelta: bn(10),
      });
    });

    describe('when reducing the max positions per account', () => {
      before('reduce max positions per account', async () => {
        await systems().PerpsMarket.connect(owner()).setPerAccountCaps(2, _UNLIMMITED);
      });
      it('should revert when attempting to open a 3rd position', async () => {
        await assertRevert(
          openPosition({
            ...commonOpenPositionProps,
            marketId: market3.marketId(),
            sizeDelta: bn(10),
          }),
          'MaxPositionsPerAccountReached("2")'
        );
      });
      it('should allow a new position if another is closed', async () => {
        await openPosition({
          ...commonOpenPositionProps,
          marketId: market1.marketId(),
          sizeDelta: bn(-10),
        });

        await openPosition({
          ...commonOpenPositionProps,
          marketId: market3.marketId(),
          sizeDelta: bn(10),
        });
      });
    });
  });
});
