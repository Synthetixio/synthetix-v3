import { BigNumber } from 'ethers';
import type { IMarketConfigurationModule } from './generated/typechain/MarketConfigurationModule';
import type { bootstrap } from './bootstrap';
import type { genOrder, genTrader, genBootstrap } from './generators';

export type Bs = ReturnType<typeof bootstrap>;
export type Collateral = ReturnType<Bs['collaterals']>[number];
export type Market = ReturnType<Bs['markets']>[number];
export type Trader = ReturnType<Bs['traders']>[number];

export type GeneratedTrader = ReturnType<typeof genTrader> | Awaited<ReturnType<typeof genTrader>>;
export type CommitableOrder = Pick<
  Awaited<ReturnType<typeof genOrder>>,
  'sizeDelta' | 'limitPrice' | 'keeperFeeBufferUsd' | 'hooks' | 'trackingCode'
>;

export type FixedMarket = {
  name: string;
  initialPrice: BigNumber;
  specific: IMarketConfigurationModule.ConfigureByMarketParametersStruct;
};

export type GeneratedBootstrap = ReturnType<typeof genBootstrap>;
