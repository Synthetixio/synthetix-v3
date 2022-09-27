// based on https://github.com/Uniswap/merkle-distributor/tree/master/src
import { ethers, utils } from 'ethers';

import MerkleTree from './merkle-tree';

export default class BalanceTree {
  tree: MerkleTree;

  constructor(balances: { account: string; amount: ethers.BigNumberish }[]) {
    this.tree = new MerkleTree(
      balances.map(({ account, amount }) => {
        return BalanceTree.toNode(account, amount);
      })
    );
  }

  // eslint-disable-next-line max-params
  static verifyProof(
    account: Buffer | string,
    amount: ethers.BigNumberish,
    proof: Buffer[],
    root: Buffer
  ) {
    let pair = BalanceTree.toNode(account, amount);

    for (const item of proof) {
      pair = MerkleTree.combinedHash(pair, item);
    }

    return pair.equals(root);
  }

  // keccak256(abi.encode(account, amount))
  static toNode(account: Buffer | string, amount: ethers.BigNumberish) {
    return Buffer.from(
      utils.solidityKeccak256(['address', 'uint256'], [account, amount]).substring(2),
      'hex'
    );
  }

  getHexRoot() {
    return this.tree.getHexRoot();
  }

  // returns the hex bytes32 values of the proof
  getProof(account: string, amount: ethers.BigNumberish) {
    return this.tree.getHexProof(BalanceTree.toNode(account, amount));
  }
}
