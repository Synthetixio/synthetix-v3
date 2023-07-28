import { PerpsMarket, bn, bootstrapMarkets } from '../bootstrap';
import { OpenPositionData, depositCollateral, openPosition } from '../helpers';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { ethers } from 'ethers';

const _SKEW_SCALE = bn(10_000);
const _MAX_FUNDING_VELOCITY = bn(3);

describe('Market Debt - with funding', () => {
  const { systems, superMarketId, perpsMarkets, provider, trader1, trader2, trader3, keeper } =
    bootstrapMarkets({
      synthMarkets: [
        {
          name: 'Bitcoin',
          token: 'snxBTC',
          buyPrice: bn(10_000),
          sellPrice: bn(10_000),
        },
      ],
      perpsMarkets: [
        {
          requestedMarketId: bn(25),
          name: 'Ether',
          token: 'snxETH',
          price: bn(1000),
          // setting to 0 to avoid funding and p/d price change affecting pnl
          fundingParams: { skewScale: _SKEW_SCALE, maxFundingVelocity: _MAX_FUNDING_VELOCITY },
          liquidationParams: {
            initialMarginFraction: bn(3),
            maintenanceMarginFraction: bn(2),
            maxLiquidationLimitAccumulationMultiplier: bn(1),
            liquidationRewardRatio: bn(0.05),
            maxSecondsInLiquidationWindow: ethers.BigNumber.from(10),
            minimumPositionMargin: bn(0),
          },
          settlementStrategy: {
            settlementReward: bn(0),
          },
        },
      ],
      traderAccountIds: [2, 3, 4],
    });
});
