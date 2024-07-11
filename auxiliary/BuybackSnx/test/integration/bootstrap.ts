import { coreBootstrap } from '@synthetixio/core-utils/utils/bootstrap/tests';
import { wei } from '@synthetixio/wei';
import { ethers } from 'ethers';

import { BuybackSnx } from '../generated/typechain';

interface Contracts {
  buyback_snx: BuybackSnx;
  'pyth.Pyth': ethers.Contract;
  'snx.MintableToken': ethers.Contract;
  'usd.MintableToken': ethers.Contract;
}

const params = { cannonfile: 'cannonfile.test.toml' };

const r = coreBootstrap<Contracts>(params);

const restoreSnapshot = r.createSnapshot();

export function bootstrap() {
  before(restoreSnapshot);
  return r;
}

export function bootstrapBuyback() {
  const r = bootstrap();

  let owner: ethers.Signer;
  let user: ethers.Signer;

  before('get signers', async function () {
    [owner, user] = r.getSigners();
  });

  return {
    ...r,
    owner: () => owner,
    user: () => user,
  };
}

export const bn = (n: number) => wei(n).toBN();
