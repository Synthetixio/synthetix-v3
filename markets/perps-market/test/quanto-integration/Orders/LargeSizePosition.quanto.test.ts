import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { bn, bootstrapMarkets } from '../../integration/bootstrap';
import { OpenPositionData, openPosition, getQuantoPositionSize } from '../../integration/helpers';
import { ethers } from 'ethers';
import { wei } from '@synthetixio/wei';

const PRICE = bn(0.00000001);
const NOTIONAL = bn(10_000_000); // sizeDelta = 1_000_000_000_000_000 (1e15)
describe.only('Large Size Position', () => {
  const perpsMarketConfigs = [
    {
      requestedMarketId: 50,
      name: 'ThisIsNotPepe',
      token: 'NOT_PEPE',
      price: PRICE,
      fundingParams: { skewScale: bn(30_000_000_000_000_000).div(2_000), maxFundingVelocity: bn(0) },
      maxMarketSize: bn(100_000_000_000_000_000),
      liquidationParams: {
        initialMarginFraction: bn(2),
        minimumInitialMarginRatio: bn(0.01),
        maintenanceMarginScalar: bn(0.5),
        maxLiquidationLimitAccumulationMultiplier: bn(1),
        liquidationRewardRatio: bn(0.05),
        maxSecondsInLiquidationWindow: ethers.BigNumber.from(10),
        minimumPositionMargin: bn(0),
      },
      settlementStrategy: {
        settlementReward: bn(0),
      },
      quanto: {
        name: 'Ether',
        token: 'ETH',
        price: bn(2_000),
        quantoSynthMarketIndex: 0,
      },
    },
  ];

  const { systems, provider, trader1, perpsMarkets, synthMarkets, keeper } = bootstrapMarkets({
    synthMarkets: [
      {
        name: 'Ether',
        token: 'sETH',
        buyPrice: bn(2000),
        sellPrice: bn(2000),
      },
    ],
    perpsMarkets: perpsMarketConfigs,
    traderAccountIds: [2],
  });

  before('trader1 buys 2_0000 sETH', async () => {
    const ethSpotMarketId = synthMarkets()[0].marketId();
    const usdAmount = bn(10_000_000);
    const minAmountReceived = bn(5_000);
    const referrer = ethers.constants.AddressZero;
    await systems()
      .SpotMarket.connect(trader1())
      .buy(ethSpotMarketId, usdAmount, minAmountReceived, referrer);
  });

  before('add collateral to margin', async () => {
    const ethSpotMarketId = synthMarkets()[0].marketId();
    await synthMarkets()[0]
      .synth()
      .connect(trader1())
      .approve(systems().PerpsMarket.address, ethers.constants.MaxUint256);
    await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, ethSpotMarketId, bn(5_000));
  });

  let commonOpenPositionProps: Pick<
    OpenPositionData,
    'systems' | 'provider' | 'trader' | 'accountId' | 'keeper'
  >;
  before('identify common props', async () => {
    commonOpenPositionProps = {
      systems,
      provider,
      trader: trader1(),
      accountId: 2,
      keeper: trader1(),
    };
  });

  before('open position', async () => {
    const sizeDelta = wei(NOTIONAL).div(wei(PRICE));
    const quantoSize = getQuantoPositionSize({
      sizeInBaseAsset: sizeDelta.bn,
      quantoAssetPrice: bn(2_000)
    });
    await openPosition({
      ...commonOpenPositionProps,
      marketId: perpsMarkets()[0].marketId(),
      sizeDelta: quantoSize,
      settlementStrategyId: perpsMarkets()[0].strategyId(),
      price: PRICE,
    });
  });

  it('should have correct open interest', async () => {
    assertBn.equal(await systems().PerpsMarket.totalAccountOpenInterest(2), NOTIONAL);
  });

  describe('can liquidate the position', () => {
    before('lower price to liquidation', async () => {
      await perpsMarkets()[0].aggregator().mockSetCurrentPrice(PRICE.div(100));
    });
    before('call liquidate', async () => {
      const res = await systems().PerpsMarket.getRequiredMargins(2);
      console.log('quanto res :', res);
      await systems().PerpsMarket.connect(keeper()).liquidate(2);
    });

    it('liquidated the position', async () => {
      const [, , size] = await systems().PerpsMarket.getOpenPosition(
        2,
        perpsMarkets()[0].marketId()
      );
      assertBn.equal(size, bn(0));
    });
  });
});
