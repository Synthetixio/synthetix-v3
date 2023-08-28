import { beforeEach, clearStore, describe, test } from 'matchstick-as';

import handleAccountCreatedTest from './handleAccountCreated';

describe('PerpsMarketProxy', () => {
  beforeEach(() => {
    clearStore();
  });

  test('handleAccountCreated', handleAccountCreatedTest);
});
