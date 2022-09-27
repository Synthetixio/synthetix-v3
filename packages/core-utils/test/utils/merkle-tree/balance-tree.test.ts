import { equal } from 'assert/strict';
import { ethers } from 'ethers';

import BalanceTree from '../../../src/utils/merkle-tree/balance-tree';

function hexStringToBuffer(data: string) {
  return Buffer.from(data.substring(2), 'hex');
}

describe('utils/merkle-tree/balance-tree.ts', function () {
  let balances: { account: string; amount: ethers.BigNumberish }[], tree: BalanceTree;

  before('build tree', function () {
    balances = [];
    for (let i = 0; i < 10; i++) {
      balances.push({
        account: ethers.Wallet.createRandom().address,
        amount: i + 1,
      });
    }

    tree = new BalanceTree(balances);
  });

  describe('when validating a proof against the right root', function () {
    it('is validated', function () {
      const proof = tree.getProof(balances[0].account, balances[0].amount);
      const root = tree.getHexRoot();

      equal(proof.length >= 2, true);
      equal(
        BalanceTree.verifyProof(
          hexStringToBuffer(balances[0].account),
          balances[0].amount,
          proof.map((e) => hexStringToBuffer(e)),
          hexStringToBuffer(root)
        ),
        true
      );
    });
  });

  describe('when validating a proof against a wrong root', function () {
    let wrongTree: BalanceTree;
    before('build wrong tree', function () {
      const newBalances = [];
      for (let i = 0; i < 10; i++) {
        newBalances.push({
          account: ethers.Wallet.createRandom().address,
          amount: i + 2,
        });
      }

      wrongTree = new BalanceTree(newBalances);
    });

    it('is rejected', function () {
      const proof = tree.getProof(balances[0].account, balances[0].amount);
      const root = wrongTree.getHexRoot();

      equal(
        BalanceTree.verifyProof(
          hexStringToBuffer(balances[0].account),
          balances[0].amount,
          proof.map((e) => hexStringToBuffer(e)),
          hexStringToBuffer(root)
        ),
        false
      );
    });
  });

  describe('when validating a proof from another element', function () {
    it('is rejected', function () {
      const proof = tree.getProof(balances[0].account, balances[0].amount);
      const root = tree.getHexRoot();

      equal(
        BalanceTree.verifyProof(
          hexStringToBuffer(balances[1].account),
          balances[1].amount,
          proof.map((e) => hexStringToBuffer(e)),
          hexStringToBuffer(root)
        ),
        false
      );
    });
  });
});
