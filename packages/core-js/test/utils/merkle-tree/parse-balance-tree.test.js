const ethers = require('ethers');
const { ok, equal } = require('assert/strict');
const { parseBalanceMap } = require('../../../utils/merkle-tree/parse-balance-tree');
const BalanceTree = require('../../../utils/merkle-tree/balance-tree');

function hexStringToBuffer(data) {
  return Buffer.from(data.substr(2), 'hex');
}

describe('utils/merkle-tree/parse-balance-tree.js', function () {
  let inputData, parsedTree;

  before('build tree', () => {
    inputData = {};
    for (let i = 0; i < 10; i++) {
      inputData[ethers.Wallet.createRandom().address] = '' + (i + 1);
    }

    parsedTree = parseBalanceMap(inputData);
  });

  it('gets a parsed tree with the right format', () => {
    ok(typeof parsedTree === 'object');
    ok(typeof parsedTree.merkleRoot === 'string');

    const key = Object.keys(parsedTree.claims)[0];

    ok(typeof parsedTree.claims === 'object');
    ok(typeof parsedTree.claims[key] === 'object');
    ok(typeof parsedTree.claims[key].amount === 'string');
    ok(typeof parsedTree.claims[key].proof === 'object');
    ok(typeof parsedTree.claims[key].proof[0] === 'string');
  });

  it('gets a valid proof for the tree root', () => {
    const account = Object.keys(parsedTree.claims)[0];

    equal(
      BalanceTree.verifyProof(
        hexStringToBuffer(account),
        parsedTree.claims[account].amount,
        parsedTree.claims[account].proof.map((e) => hexStringToBuffer(e)),
        hexStringToBuffer(parsedTree.merkleRoot)
      ),
      true
    );
  });
});
