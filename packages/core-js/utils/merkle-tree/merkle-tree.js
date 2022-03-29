const { bufferToHex, keccak256 } = require('ethereumjs-util');

class MerkleTree {
  constructor(elements) {
    this.elements = [...elements];
    // Sort elements
    this.elements.sort(Buffer.compare);
    // Deduplicate elements
    this.elements = MerkleTree._bufDedup(this.elements);

    this.bufferElementPositionIndex = this.elements.reduce((memo, el, index) => {
      memo[bufferToHex(el)] = index;
      return memo;
    }, {});

    // Create layers
    this.layers = this.getLayers(this.elements);
  }

  getLayers(elements) {
    if (elements.length === 0) {
      throw new Error('empty tree');
    }

    const layers = [];
    layers.push(elements);

    // Get next layer until we reach the root
    while (layers[layers.length - 1].length > 1) {
      layers.push(this.getNextLayer(layers[layers.length - 1]));
    }

    return layers;
  }

  getNextLayer(elements) {
    // eslint-disable-next-line max-params
    return elements.reduce((layer, el, idx, arr) => {
      if (idx % 2 === 0) {
        // Hash the current element with its pair element
        layer.push(MerkleTree.combinedHash(el, arr[idx + 1]));
      }

      return layer;
    }, []);
  }

  static combinedHash(first, second) {
    if (!first) {
      return second;
    }
    if (!second) {
      return first;
    }

    return keccak256(MerkleTree._sortAndConcat(first, second));
  }

  getRoot() {
    return this.layers[this.layers.length - 1][0];
  }

  getHexRoot() {
    return bufferToHex(this.getRoot());
  }

  getProof(el) {
    let idx = this.bufferElementPositionIndex[bufferToHex(el)];

    if (typeof idx !== 'number') {
      throw new Error('Element does not exist in Merkle tree');
    }

    return this.layers.reduce((proof, layer) => {
      const pairElement = MerkleTree._getPairElement(idx, layer);

      if (pairElement) {
        proof.push(pairElement);
      }

      idx = Math.floor(idx / 2);

      return proof;
    }, []);
  }

  getHexProof(el) {
    const proof = this.getProof(el);

    return MerkleTree._bufArrToHexArr(proof);
  }

  static _getPairElement(idx, layer) {
    const pairIdx = idx % 2 === 0 ? idx + 1 : idx - 1;

    if (pairIdx < layer.length) {
      return layer[pairIdx];
    } else {
      return null;
    }
  }

  static _bufDedup(elements) {
    return elements.filter((el, idx) => {
      return idx === 0 || !elements[idx - 1].equals(el);
    });
  }

  static _bufArrToHexArr(arr) {
    if (arr.some((el) => !Buffer.isBuffer(el))) {
      throw new Error('Array is not an array of buffers');
    }

    return arr.map((el) => '0x' + el.toString('hex'));
  }

  static _sortAndConcat(...args) {
    return Buffer.concat([...args].sort(Buffer.compare));
  }
}

module.exports = MerkleTree;
