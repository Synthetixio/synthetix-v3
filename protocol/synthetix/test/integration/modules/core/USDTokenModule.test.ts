import assert from 'assert/strict';
import { bootstrap } from '../../bootstrap';
import { ethers } from 'ethers';
import { verifyUsesFeatureFlag } from '../../verifications';

describe('USDTokenModule', function () {
  const { signers, systems } = bootstrap();

  const usdAmount = 100;

  let owner: ethers.Signer, user1: ethers.Signer, user2: ethers.Signer;

  before('identify signers', async () => {
    [owner, user1, user2] = signers();
  });

  it('USD is deployed and registered', async () => {
    const info = await systems().Core.getAssociatedSystem(
      ethers.utils.formatBytes32String('USDToken')
    );
    assert.equal(info.addr, systems().USD.address);
  });

  it('applied the USD parameters', async () => {
    assert.equal(await systems().USD.name(), 'Synthetic USD Token v3');
    assert.equal(await systems().USD.symbol(), 'snxUSD');
    assert.equal(await systems().USD.decimals(), 18);
  });

  describe('transferCrossChain()', () => {
    verifyUsesFeatureFlag(
      () => systems().Core,
      'transferCrossChain',
      () => systems().USD.connect(user1).transferCrossChain(1, ethers.constants.AddressZero, usdAmount)
    );

    it('only works if user has enough snxUSD', async () => {});
    
    describe('successful call', () => {
      it('burns the correct amount of snxUSD on the source chain', async () => {});

      it('triggers cross chain transfer call', async () => {});
    });
  });
});
