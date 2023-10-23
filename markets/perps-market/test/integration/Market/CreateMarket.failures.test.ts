import { bootstrap } from '../bootstrap';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';

describe('Create Market test - not initialized failure', () => {
  const name = 'Ether',
    token = 'snxETH';

  const { systems, owner } = bootstrap();

  it('reverts when trying to create a market', async () => {
    await assertRevert(
      systems().PerpsMarket.connect(owner()).createMarket(1, name, token),
      'PerpsMarketNotInitialized'
    );
  });
});
