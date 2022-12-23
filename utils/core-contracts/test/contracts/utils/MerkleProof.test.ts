import assert from 'node:assert/strict';
import MerkleTree from '@synthetixio/core-utils/utils/merkle-tree/merkle-tree.js';
import hre from 'hardhat';
import { MerkleProofMock } from '../../../typechain-types';

describe('MerkleProof', () => {
  let MerkleProof: MerkleProofMock;
  let merkleTree: MerkleTree;
  let elements: string[];

  before('get some elements', async () => {
    elements = Array.from(Array(10)).map((_, i) => {
      return hre.ethers.utils.formatBytes32String(`${i}`);
    });
  });

  before('deploy the contract', async () => {
    const factory = await hre.ethers.getContractFactory('MerkleProofMock');
    MerkleProof = await factory.deploy();
  });

  before('build a merkle tree', () => {
    merkleTree = new MerkleTree(elements.map((e) => Buffer.from(e.substr(2), 'hex')));
  });

  describe('verify(bytes32[] memory proof, bytes32 root, bytes32 leaf', () => {
    it('shows a valid proof pass', async () => {
      assert.equal(
        await MerkleProof.verify(
          merkleTree.getHexProof(Buffer.from(elements[0].substr(2), 'hex')),
          merkleTree.getHexRoot(),
          Buffer.from(elements[0].substr(2), 'hex')
        ),
        true
      );
    });

    it('shows a proof for another entry fails', async () => {
      assert.equal(
        await MerkleProof.verify(
          merkleTree.getHexProof(Buffer.from(elements[0].substr(2), 'hex')),
          merkleTree.getHexRoot(),
          Buffer.from(elements[1].substr(2), 'hex')
        ),
        false
      );
    });
    it('shows an invalid proof fails', async () => {
      const proof = merkleTree.getHexProof(Buffer.from(elements[0].substr(2), 'hex'));
      proof.pop(); // Introduce an error in the proof removing one element

      assert.equal(
        await MerkleProof.verify(
          proof,
          merkleTree.getHexRoot(),
          Buffer.from(elements[0].substr(2), 'hex')
        ),
        false
      );
    });
  });
});
