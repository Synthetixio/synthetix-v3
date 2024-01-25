import assert from 'assert';
import { integrationBootstrap } from './bootstrap';

describe('cross chain nft distribution', function () {
  const { chains } = integrationBootstrap();

  it('allows onwer mint nft', async function () {
    for (const chain of Object.values(chains)) {
      const ownerAddress = await chain.signer.getAddress();
      assert.equal((await chain.CouncilToken.balanceOf(ownerAddress)).toString(), '1');
    }
  });
});
