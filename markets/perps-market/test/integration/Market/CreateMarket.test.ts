import assertBignumber from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import { bn, bootstrapMarkets } from '../bootstrap';
import { BigNumber } from 'ethers';

describe('CreatePerpMarket', () => {
  const { systems } = bootstrapMarkets({
    synthMarkets: [],
    perpsMarkets: [{ name: 'Ether', token: 'snxETH', price: bn(1000) }],
    traderAccountIds: [],
  });

  it('returns all perps market ids', async () => {
    const [id] = await systems().PerpsMarket.getPerpsMarketIds();
    assertBignumber.equal(id, BigNumber.from(1));
  });
});
