import { ethers } from 'ethers';

import { bootstrap } from '../bootstrap';

describe.only('AccountModule', function () {
  const { signers, systems } = bootstrap();

  let owner: ethers.Signer;

  before('identify signers', async () => {
    [owner] = signers();
  });

  it('test something...', async function () {
    // TODO
  });
});
