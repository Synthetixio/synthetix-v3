import { ethers } from 'ethers';

import { bootstrapWithStakedPool } from '@synthetixio/main/test/integration/bootstrap';

describe('SpotMarket', function () {
  const { signers, systems } = bootstrapWithStakedPool();

  let user1: ethers.Signer;

  before('identify signers', async () => {
    [, user1] = signers();
  });

  describe('registerMarket', function () {
    it('works', async function () {
      await (
        await systems()
          .Core.connect(user1)
          .createPool(2, await user1.getAddress())
      ).wait();
    });

    // TODO: write tests
  });
});
