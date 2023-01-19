import { ethers as Ethers } from 'ethers';
import { bootstrapTraders, bootstrapWithSynth } from './bootstrap';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assert from 'assert';

describe('Market', () => {
  const { systems, signers } = bootstrapTraders(bootstrapWithSynth('Synthetic Ether', 'snxETH')); // creates traders with USD

  let marketOwner: Ethers.Signer, user1: Ethers.Signer, user2: Ethers.Signer;

  before('identify actors', async () => {
    [, , marketOwner, user1, user2] = signers();
  });

  describe('transfering market ownership', () => {
    it('nominateNewMarketOwner reverts if is not called by the market owner', async () => {
      await assertRevert(
        systems()
          .SpotMarket.connect(user1)
          .nominateNewMarketOwner(1, await user2.getAddress()),
        'OnlyMarketOwner'
      );
    });

    it('nominateNewMarketOwner nominate a new owner for the pool', async () => {
      await systems()
        .SpotMarket.connect(marketOwner)
        .nominateNewMarketOwner(1, await user2.getAddress()),
        'OnlyMarketOwner';
    });

    it('only the nominated user can accept', async () => {
      await assertRevert(
        systems().SpotMarket.connect(user1).acceptMarketOwnership(1),
        'NotNominated'
      );
    });

    it('the nominated user can acceptMarketOwnership and become new market owner', async () => {
      await systems().SpotMarket.connect(user2).acceptMarketOwnership(1);
    });

    it('check ownership is transfered', async () => {
      assert.equal(await systems().SpotMarket.getMarketOwner(1), await user2.getAddress());
    });
  });
});
