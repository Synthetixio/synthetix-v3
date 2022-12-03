import { deepEqual, throws } from 'assert/strict';
import { keccak256 } from 'ethereumjs-util';

import MerkleTree from '../../../src/utils/merkle-tree/merkle-tree';

describe('utils/merkle-tree/merkle-tree.ts', function () {
  describe('basic tree', function () {
    let elements: Buffer[], root: Buffer, tree: MerkleTree;

    before('create the smallest tree', function () {
      elements = [];
      elements.push(Buffer.from('1'));
      elements.push(Buffer.from('2'));
      root = keccak256(Buffer.concat(elements.sort(Buffer.compare)));
      tree = new MerkleTree(elements);
    });

    it('root is valid', function () {
      deepEqual(root, tree.getRoot());
    });

    it('hex root is valid', function () {
      deepEqual('0x' + root.toString('hex'), tree.getHexRoot());
    });

    it('proofs are valid', function () {
      deepEqual([elements[1]], tree.getProof(elements[0]));
      deepEqual([elements[0]], tree.getProof(elements[1]));
    });

    it('hex proofs are valid', function () {
      deepEqual(['0x' + elements[1].toString('hex')], tree.getHexProof(elements[0]));
      deepEqual(['0x' + elements[0].toString('hex')], tree.getHexProof(elements[1]));
    });
  });

  describe('large tree', function () {
    let elements: Buffer[], tree: MerkleTree;

    before('create a large tree', function () {
      elements = [];
      for (let i = 1; i < 100000; i++) {
        elements.push(Buffer.from('' + i));
      }
      tree = new MerkleTree(elements);
    });

    it('proof is valid (calculated offline)', function () {
      const proof = [
        '0x3130',
        '0x2f577a9004fb8afc70f705780ac13847591b610cf896b9f10f9fb40c32f6c619',
        '0x39304c411ceea42dd7d785f00b820ec18ba9051d1d72e3c2335de7a775a77054',
        '0x49ce22d2edf5a0cd2a09f1c3976dfc3f31faafeacdfb2d5753367a6b0b86999f',
        '0x5e85690946df43a366f4dae22e510544e9535d67d1085a0d457b4f76004e5637',
        '0x27759ecb9cdfce0822d095f4e6b8a67e6a940985d3766a2adb7a44517ee38ec2',
        '0xb2fc4470132247328384f5bf5bea53a185ffaf21d4083784dcb5ae636ae8fef6',
        '0x19ad8c89ec97cabb82085261a727d81b6a6e132e9671cb4f463f3e140994a6e2',
        '0x940ce297813d789ca1712e42f4d2c923976bda61995c33a2478ab122ee1c8254',
        '0x37e0fcf84c3ecf82e1c3afdf77a9ec98bac1c321a186b6dccd49d9a6f4618c0d',
        '0x492d47747744e8a1dcd6a312a17025d479a1aec8598f4152a3ea5b5416826a8a',
        '0x6fae9c4863f5107a9f1570b407adcddc9dfefcdfffca846b80a69848189ea88c',
        '0xbed2a885cfbc8f1aa6f498cde9e7ceadacc339d64f591f60cc81a670de297383',
        '0x906dc3dd7be9ec06912f52a7a6c64c13fc04b9839bf9fb0cd201c2c062fda277',
        '0x30e7d40dc28baae6a745c673d45062590c34b95c00875ae159f7e2e35e767d4d',
        '0x7ec791713b6e1f992c70f2e18acd3d19db715ff75d247fc2acc46ab70d4ba7e9',
        '0x5c1ed5d5c70d2b32aa8366b22bc70b86bdcf9fa1033d21fe0fcb4ff9ec293e05',
      ];

      deepEqual(proof, tree.getHexProof(elements[0]));
    });

    it('root is valid (calculated offline)', function () {
      const root = '0x851a1a8eeb1f817cd7f713c0e25ba14bffb4d3d1c8fbc9c1682a254640592df5';
      deepEqual(root, tree.getHexRoot());
    });
  });

  describe('when creating an empty tree', function () {
    it('throws an error', function () {
      throws(() => {
        new MerkleTree([]);
      }, 'Error: empty tree');
    });
  });

  describe('when attempting to get the proof of an invalid element', function () {
    let elements: Buffer[], tree: MerkleTree;

    before('create the smallest tree', function () {
      elements = [];
      elements.push(Buffer.from('1'));
      elements.push(Buffer.from('2'));
      tree = new MerkleTree(elements);
    });

    it('throws an error', function () {
      throws(() => {
        tree.getProof(Buffer.from('3'));
      }, 'Error: Element does not exist in Merkle tree');
    });
  });

  describe('when combining hashes', function () {
    it('combines two hashes', function () {
      const hash1 = Buffer.from('1');
      const hash2 = Buffer.from('2');

      deepEqual(MerkleTree.combinedHash(hash1, hash2), keccak256(Buffer.concat([hash1, hash2])));
      deepEqual(MerkleTree.combinedHash(hash2, hash1), keccak256(Buffer.concat([hash1, hash2])));
      deepEqual(MerkleTree.combinedHash(null, hash2), hash2);
      deepEqual(MerkleTree.combinedHash(hash1, null), hash1);
    });
  });
});
