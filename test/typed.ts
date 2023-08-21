import type { bootstrap } from './bootstrap';

export type Bs = ReturnType<typeof bootstrap>;
export type Collateral = ReturnType<Bs['collaterals']>[number];
export type Market = ReturnType<Bs['markets']>[number];
export type Trader = ReturnType<Bs['traders']>[number];
