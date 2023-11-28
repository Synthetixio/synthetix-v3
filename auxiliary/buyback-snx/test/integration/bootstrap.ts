import { coreBootstrap } from '@synthetixio/router/utils/tests';
import { wei } from '@synthetixio/wei';
import { ethers } from 'ethers';
import hre from 'hardhat';
import { BuybackSnx, ERC20Mock } from '../../typechain-types';

interface Contracts {
  BuybackSnx: BuybackSnx;
}
const r = coreBootstrap<Contracts>();

const restoreSnapshot = r.createSnapshot();

export function bootstrap() {
  before(restoreSnapshot);
  return r;
}

export function bootstrapWithNodes() {
  const r = bootstrap();

  let ERC20: ERC20Mock;

  let owner: ethers.Signer;
  let user: ethers.Signer;

  before('get signers', async function () {
    [owner, user] = r.getSigners();
  });

  before('deploy buyback contract', async () => {
    const factory = await hre.ethers.getContractFactory('BuybackSnx');
    await factory.connect(owner).deploy(await owner.getAddress());
  });

  return {
    ...r,
    owner: () => owner,
    user: () => user,
  };
}

export const bn = (n: number) => wei(n).toBN();
