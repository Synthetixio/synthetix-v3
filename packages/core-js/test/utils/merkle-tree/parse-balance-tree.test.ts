import { ethers } from 'ethers';
import { ok, equal, throws } from 'assert/strict';
import { parseBalanceMap } from '../../../utils/merkle-tree/parse-balance-tree';
import BalanceTree from '../../../utils/merkle-tree/balance-tree';

function hexStringToBuffer(data: string) {
  return Buffer.from(data.substring(2), 'hex');
}

describe('utils/merkle-tree/parse-balance-tree.js', function () {
  describe('when parsing vaild input data', () => {
    let inputData: { [address: string]: ethers.BigNumberish },
      parsedTree: ReturnType<typeof parseBalanceMap>;

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

  describe('when attempting to parse an invalid address', () => {
    let inputData: { [address: string]: ethers.BigNumberish };

    before('build input data', () => {
      inputData = {};
      for (let i = 0; i < 10; i++) {
        inputData[ethers.Wallet.createRandom().address] = '' + (i + 1);
      }
      inputData['0x00112233'] = '12';
    });

    it('throws an arror', () => {
      throws(() => {
        parseBalanceMap(inputData);
      }, 'Error: Found invalid address: 0x00112233');
    });
  });
  describe('when attempting to parse an zero balance', () => {
    let inputData: { [address: string]: ethers.BigNumberish };

    before('build input data', () => {
      inputData = {};
      for (let i = 0; i < 10; i++) {
        inputData[ethers.Wallet.createRandom().address] = '' + (i + 1);
      }
      inputData[ethers.Wallet.createRandom().address] = '0';
    });

    it('throws an arror', () => {
      throws(() => {
        parseBalanceMap(inputData);
      }, 'Error: Invalid amount for account: ');
    });
  });
});
