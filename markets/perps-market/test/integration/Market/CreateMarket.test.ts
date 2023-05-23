import { ethers } from 'ethers';
import { bn, bootstrapMarkets } from '../bootstrap';

describe('CreatePerpMarket', () => {
  const accountIds = [10];
  const { systems } = bootstrapMarkets({
    synthMarkets: [],
    perpsMarkets: [{ name: 'Ether', token: 'snxETH', price: bn(1000) }],
    traderAccountIds: [],
  });

  it('returns all perps market ids', async () => {
    const ids = await systems().PerpsMarket.getPerpsMarketIds();
    console.log(ids);
  });
});
