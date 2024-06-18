import assert from 'node:assert/strict';
import { ethers } from 'ethers';

type Addressish = string | `0x${string}` | ethers.BigNumberish;

export function addressEqual(address1: Addressish, address2: Addressish) {
  return (
    ethers.utils.getAddress(address1 as string) === ethers.utils.getAddress(address2 as string)
  );
}

export function assertAddress(address: Addressish) {
  assert.ok(ethers.utils.isAddress(address as string), `Invalid address: ${address}`);
}

export function assertAddressEqual(address1: Addressish, address2: Addressish) {
  assert.equal(
    ethers.utils.getAddress(address1 as string),
    ethers.utils.getAddress(address2 as string)
  );
}
