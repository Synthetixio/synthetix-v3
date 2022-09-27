import assert from 'assert/strict';
import { ethers } from 'ethers';

import dummyABI from '../../fixtures/dummy-abi.json';
import {
  deployedContractHasBytescode,
  getBytecodeHash,
  getRemoteBytecode,
  getSelectors,
} from '../../../src/utils/ethers/contracts';

describe('utils/ethers/contracts.ts', function () {
  const dummyAddress = '0x0000000000000000000000000000000000000001';
  const dummyBytecode =
    '0x363d3d373d3d3d363d73bebebebebebebebebebebebebebebebebebebebe5af43d82803e903d91602b57fd5bf3';
  const dummyBytecodeHash = '0x77c4c6d51b5c0232bcb5f2cd68782ab6de267370915e95489ebcc0fcdc81faba';
  const dummyProvider = {
    getCode: async () => dummyBytecode,
  } as unknown as ethers.providers.Provider;

  it('can retrieve the hash of the bytecode of a contract', function () {
    assert.equal(getBytecodeHash(dummyBytecode), dummyBytecodeHash);
  });

  it('can retrieve the bytecode of a contract', async function () {
    assert.equal(await getRemoteBytecode(dummyAddress, dummyProvider), dummyBytecode);
  });

  it('can compare bytecodes', async function () {
    assert.equal(
      await deployedContractHasBytescode(dummyAddress, dummyBytecode, dummyProvider),
      true
    );
  });

  it('can retrieve contract selectors', async function () {
    assert.deepEqual(await getSelectors(dummyABI), [
      {
        name: 'transfer',
        selector: '0xa9059cbb',
      },
    ]);
  });
});
