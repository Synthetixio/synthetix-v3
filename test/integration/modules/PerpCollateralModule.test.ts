import { bootstrap } from '../../bootstrap';
import assert from 'assert';

describe('XModule', async () => {
  await bootstrap();

  it('should do the thing', () => {
    assert.equal(1, 1);
  });
});
