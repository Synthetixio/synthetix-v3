// based on https://github.com/Uniswap/merkle-distributor/tree/master/src
import { utils } from 'ethers';
import MerkleTree from './merkle-tree';

class BalanceTree {
  constructor(balances) {
    this.tree = new MerkleTree(
      balances.map(({ account, amount }) => {
        return BalanceTree.toNode(account, amount);
      })
    );
  }

  static verifyProof(account, amount, proof, root) {
    let pair = BalanceTree.toNode(account, amount);
    for (const item of proof) {
      pair = MerkleTree.combinedHash(pair, item);
    }

    return pair.equals(root);
  }

  // keccak256(abi.encode(account, amount))
  static toNode(account, amount) {
    return Buffer.from(
      utils.solidityKeccak256(['address', 'uint256'], [account, amount]).substr(2),
      'hex'
    );
  }

  getHexRoot() {
    return this.tree.getHexRoot();
  }

  // returns the hex bytes32 values of the proof
  getProof(account, amount) {
    return this.tree.getHexProof(BalanceTree.toNode(account, amount));
  }
}

module.exports = BalanceTree;
