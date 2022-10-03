import { ethers } from 'ethers';

export const BN_ONE = ethers.BigNumber.from(1);
export const BN_TWO = ethers.BigNumber.from(2);

export function bnSqrt(value: ethers.BigNumber) {
  let z = value.add(BN_ONE).div(BN_TWO);
  let y = value;

  while (z.sub(y).isNegative()) {
    y = z;
    z = value.div(z).add(z).div(BN_TWO);
  }

  return y;
}
