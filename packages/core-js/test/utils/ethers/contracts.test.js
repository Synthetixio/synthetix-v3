const assert = require('assert/strict');
const {
  getBytecodeHash,
  getRemoteBytecode,
  deployedContractHasBytescode,
  getSelectors,
} = require('../../../utils/ethers/contracts');
const dummyABI = require('../fixtures/dummy-abi');

describe('utils/ethers/contracts.js', function () {
  const dummyAddress = '0x0000000000000000000000000000000000000001';
  const dummyBytecode =
    '0x363d3d373d3d3d363d73bebebebebebebebebebebebebebebebebebebebe5af43d82803e903d91602b57fd5bf3';
  const dummyBytecodeHash = '0x77c4c6d51b5c0232bcb5f2cd68782ab6de267370915e95489ebcc0fcdc81faba';
  const dummyProvider = {
    getCode: async () => dummyBytecode,
  };

  it('can retrieve the hash of the bytecode of a contract', function () {
    assert.equal(getBytecodeHash(dummyBytecode), dummyBytecodeHash);
  });

  it('can retrieve the bytecode of a contract', async () => {
    assert.equal(await getRemoteBytecode(dummyAddress, dummyProvider), dummyBytecode);
  });

  it('can compare bytecodes', async () => {
    assert.equal(
      await deployedContractHasBytescode(dummyAddress, dummyBytecode, dummyProvider),
      true
    );
  });

  it('can retrieve contract selectors', async () => {
    assert.deepEqual(await getSelectors(dummyABI), [
      {
        name: 'transfer',
        selector: '0xa9059cbb',
      },
    ]);
  });
});
