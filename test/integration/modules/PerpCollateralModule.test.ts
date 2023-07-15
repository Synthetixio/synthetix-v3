import { bootstrap } from '../../bootstrap';
import assert from 'assert';

describe('PerpCollateralModule', async () => {
  const { provider, signers, owner, systems } = bootstrap();

  it('should do the thing', async () => {
    const b = await provider().getBlock('latest');
    console.log(b);
    assert.equal(1, 1);
  });
});
