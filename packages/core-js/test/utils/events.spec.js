const ethers = require('ethers');
const assert = require('assert/strict');
const { findEvent } = require('../../utils/events');

/* eslint-disable */
const normalTxReceipt = {
  to: '0x09635F643e140090A9A8Dcd712eD6285858ceBef',
  from: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  contractAddress: null,
  transactionIndex: 0,
  gasUsed: {
    type: 'BigNumber',
    hex: '0x8dac',
  },
  logsBloom:
    '0x00000000000000000000080000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000080000000000008000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  blockHash: '0x48eb1d3cc2e7e7645890eb4d419224abfad06e7c19ff7d0d6c7e73a9b3ca8a93',
  transactionHash: '0x0a5a04a58ec6ba103437dd6c562df8519b7ed15bf6339ce886daa343d7fccfb9',
  logs: [
    {
      transactionIndex: 0,
      blockNumber: 43,
      transactionHash: '0x0a5a04a58ec6ba103437dd6c562df8519b7ed15bf6339ce886daa343d7fccfb9',
      address: '0x09635F643e140090A9A8Dcd712eD6285858ceBef',
      topics: ['0xf3f57717dff9f5f10af315efdbfadc60c42152c11fc0c3c413bbfbdc661f143c'],
      data: '0x000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266000000000000000000000000000000000000000000000000000000000000002a',
      logIndex: 0,
      blockHash: '0x48eb1d3cc2e7e7645890eb4d419224abfad06e7c19ff7d0d6c7e73a9b3ca8a93',
    },
  ],
  blockNumber: 43,
  confirmations: 1,
  cumulativeGasUsed: {
    type: 'BigNumber',
    hex: '0x8dac',
  },
  effectiveGasPrice: {
    type: 'BigNumber',
    hex: '0xcb8972',
  },
  status: 1,
  type: 2,
  byzantium: true,
  events: [
    {
      transactionIndex: 0,
      blockNumber: 43,
      transactionHash: '0x0a5a04a58ec6ba103437dd6c562df8519b7ed15bf6339ce886daa343d7fccfb9',
      address: '0x09635F643e140090A9A8Dcd712eD6285858ceBef',
      topics: ['0xf3f57717dff9f5f10af315efdbfadc60c42152c11fc0c3c413bbfbdc661f143c'],
      data: '0x000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266000000000000000000000000000000000000000000000000000000000000002a',
      logIndex: 0,
      blockHash: '0x48eb1d3cc2e7e7645890eb4d419224abfad06e7c19ff7d0d6c7e73a9b3ca8a93',
      args: {
        sender: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        value: '42',
      },
      event: 'ValueSet',
      eventSignature: 'ValueSet(address,uint256)',
    },
  ],
};

const deploymentTxReceipt = {
  to: null,
  from: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  contractAddress: '0xc351628EB244ec633d5f21fBD6621e1a683B1181',
  transactionIndex: 0,
  gasUsed: {
    type: 'BigNumber',
    hex: '0x01fc48',
  },
  logsBloom:
    '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000002000000004000000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000000000000000000',
  blockHash: '0x362beebe0b7a201bfa08d2f9336e93214a2809ecbe9faec28f8590d540955443',
  transactionHash: '0x849b033c0ee690c8b9a53057495d9b3e16588a26d51a7cad4dfc6cd3d310ce0e',
  logs: [
    {
      transactionIndex: 0,
      blockNumber: 90,
      transactionHash: '0x849b033c0ee690c8b9a53057495d9b3e16588a26d51a7cad4dfc6cd3d310ce0e',
      address: '0xc351628EB244ec633d5f21fBD6621e1a683B1181',
      topics: ['0xaa9449f2bca09a7b28319d46fd3f3b58a1bb7d94039fc4b69b7bfe5d8535d527'],
      data: '0x000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266',
      logIndex: 0,
      blockHash: '0x362beebe0b7a201bfa08d2f9336e93214a2809ecbe9faec28f8590d540955443',
    },
  ],
  blockNumber: 90,
  confirmations: 1,
  cumulativeGasUsed: {
    type: 'BigNumber',
    hex: '0x01fc48',
  },
  effectiveGasPrice: {
    type: 'BigNumber',
    hex: '0x4522',
  },
  status: 1,
  type: 2,
  byzantium: true,
};

const dummyABI = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'address',
        name: 'sender',
        type: 'address',
      },
    ],
    name: 'Test',
    type: 'event',
  },
];
/* eslint-enable */

describe('utils/events.js', () => {
  it('can retrieve events from a regular transaction receipt', async () => {
    const event = findEvent({ receipt: normalTxReceipt, eventName: 'ValueSet' });

    assert.equal(event.event, 'ValueSet');
    assert.equal(event.args.sender, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    assert.equal(event.args.value, '42');
  });

  it('throws if the receipt logs are not parsed and no contract is specified for manual parsing', async () => {
    assert.throws(() => findEvent({ receipt: deploymentTxReceipt, eventName: 'Test' }), {
      message:
        'Cannot find event Test in logs, and no contract interface was provided for manual parsing.',
    });
  });

  it('can retrieve events from a deployment transaction receipt if a contract interface is provided', async () => {
    const contract = await new ethers.Contract(
      '0x0000000000000000000000000000000000000001',
      dummyABI
    );

    const event = findEvent({ receipt: deploymentTxReceipt, eventName: 'Test', contract });

    assert.equal(event.event, 'Test');
    assert.equal(event.args.sender, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
  });
});
