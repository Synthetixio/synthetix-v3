import { ethers as Ethers } from 'ethers';
import { bootstrapTraders, bootstrapWithSynth } from './bootstrap';

describe.only('Atomic Order Module', () => {
  const { systems, signers } = bootstrapWithSynth('Synthetic Ether', 'snxETH');
  bootstrapTraders({ systems, signers }); // creates traders with USD

  let owner: Ethers.Signer, marketOwner: Ethers.Signer, trader1: Ethers.Signer;
  before('identify actors', async () => {
    [owner, marketOwner, , trader1] = signers();
  });

  it('works', async () => {
    console.log('owner', await systems().USD.balanceOf(await trader1.getAddress()));
  });
});
