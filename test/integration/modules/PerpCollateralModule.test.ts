import { bootstrap } from '../../bootstrap';
import assert from 'assert';

describe('PerpCollateralModule', async () => {
  // Hardcoding args here but this will eventually be moved into generators.
  bootstrap({
    markets: [],
  });

  it('should do the thing', async () => {
    assert.equal(1, 1);
  });
});
