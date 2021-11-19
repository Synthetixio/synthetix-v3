const assert = require('assert/strict');
const {
  getBytecodeHash,
  getRemoteBytecode,
  deployedContractHasBytescode,
  getSelectors,
} = require('../../utils/contracts');

describe('utils/contracts.js', function () {
  const dummyAddress = '0x0000000000000000000000000000000000000001';
  const dummyBytecode =
    '0x363d3d373d3d3d363d73bebebebebebebebebebebebebebebebebebebebe5af43d82803e903d91602b57fd5bf3';
  const dummyBytecodeHash = '0x77c4c6d51b5c0232bcb5f2cd68782ab6de267370915e95489ebcc0fcdc81faba';
  const dummyProvider = {
    getCode: async () => dummyBytecode,
  };
  const dummyABI = [
    {
      constant: false,
      inputs: [
        {
          internalType: 'address',
          name: 'dst',
          type: 'address',
        },
        {
          internalType: 'uint256',
          name: 'wad',
          type: 'uint256',
        },
      ],
      name: 'transfer',
      outputs: [
        {
          internalType: 'bool',
          name: '',
          type: 'bool',
        },
      ],
      payable: false,
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [
        {
          internalType: 'uint256',
          name: 'chainId_',
          type: 'uint256',
        },
      ],
      payable: false,
      stateMutability: 'nonpayable',
      type: 'constructor',
    },
  ];

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
