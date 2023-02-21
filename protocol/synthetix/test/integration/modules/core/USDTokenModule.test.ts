import assert from 'assert/strict';
import { bootstrap } from '../../bootstrap';
import { ethers } from 'ethers';

describe('USDTokenModule', function () {
  const { systems } = bootstrap();

  it('USD is deployed and registered', async () => {
    const info = await systems().Core.getAssociatedSystem(
      ethers.utils.formatBytes32String('USDToken')
    );
    assert.equal(info.addr, systems().USD.address);
  });

  it('applied the USD parameters', async () => {
    assert.equal(await systems().USD.name(), 'Synthetix V3 Stablecoin');
    assert.equal(await systems().USD.symbol(), 'snxUSD');
    assert.equal(await systems().USD.decimals(), 18);
  });
});
