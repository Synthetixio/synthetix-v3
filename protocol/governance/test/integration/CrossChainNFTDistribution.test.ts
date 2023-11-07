import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assert from 'assert';
import { integrationBootstrap } from './bootstrap';

describe('cross chain nft distribution', function () {
  const { chains, fixtureSignerOnChains } = integrationBootstrap();

  const nftToken = { tokenName: 'TESTNFT', tokenSymbol: '$TN', uri: 'https://google.com' };

  it('NFT Module is not initialized', async function () {
    for (const chain of Object.values(chains)) {
      assert.equal(await chain.CoreProxy.isInitialized(), false);
    }
  });

  it('distributes NFTS after election', async function () {
    for (const chain of Object.values(chains)) {
      await chain.CoreProxy.initialize(nftToken.tokenName, nftToken.tokenSymbol, nftToken.uri);
      assert.equal(await chain.CoreProxy.isInitialized(), true);
    }
  });

  it('allows onwer mint nft', async function () {
    for (const chain of Object.values(chains)) {
      const ownerAddress = await chain.signer.getAddress();
      await chain.CoreProxy.mint(ownerAddress, 1);
      assert.equal((await chain.CoreProxy.balanceOf(ownerAddress)).toString(), '1');
    }
  });

  it('allows owner burn nft', async function () {
    for (const chain of Object.values(chains)) {
      const ownerAddress = await chain.signer.getAddress();
      await chain.CoreProxy.burn(1);
      assert.equal((await chain.CoreProxy.balanceOf(ownerAddress)).toString(), '0');
    }
  });

  it('random user cant mint', async function () {
    const randomUser = await fixtureSignerOnChains();

    for (const [chainName, chain] of Object.entries(chains)) {
      const user = randomUser[chainName as keyof typeof chains];
      await assertRevert(
        chain.CoreProxy.connect(user).mint(await chain.signer.getAddress(), 1),
        'Unauthorized'
      );
    }
  });
});
