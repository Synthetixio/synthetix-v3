module.exports = {
  inputs: [
    { internalType: 'bytes32', name: 'synth', type: 'bytes32' },
    { internalType: 'string', name: 'synthName', type: 'string' },
    { internalType: 'string', name: 'synthSymbol', type: 'string' },
    { internalType: 'uint8', name: 'synthDecimals', type: 'uint8' },
  ],
  name: 'createSynth',
  outputs: [],
  stateMutability: 'nonpayable',
  type: 'function',
};
