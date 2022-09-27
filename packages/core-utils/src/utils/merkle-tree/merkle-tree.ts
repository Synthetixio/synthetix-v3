import { bufferToHex, keccak256 } from 'ethereumjs-util';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface BufferArray extends Array<Buffer> {}

type BufferTree = Buffer | BufferArray;

export default class MerkleTree {
  elements: Buffer[];
  layers: BufferTree[];
  bufferElementPositionIndex: { [key: string]: number };

  constructor(elements: Buffer[]) {
    this.elements = [...elements];
    // Sort elements
    this.elements.sort(Buffer.compare);
    // Deduplicate elements
    this.elements = MerkleTree._bufDedup(this.elements);

    this.bufferElementPositionIndex = this.elements.reduce((memo, el, index) => {
      memo[bufferToHex(el)] = index;
      return memo;
    }, {} as typeof this.bufferElementPositionIndex);

    // Create layers
    this.layers = this.getLayers(this.elements);
  }

  getLayers(elements: BufferTree) {
    if (elements.length === 0) {
      throw new Error('empty tree');
    }

    const layers: BufferTree[] = [];
    layers.push(elements);

    // Get next layer until we reach the root
    while (layers[layers.length - 1].length > 1) {
      const lastLayer = layers[layers.length - 1];
      layers.push(this.getNextLayer(lastLayer as Buffer[]));
    }

    return layers;
  }

  getNextLayer(elements: Buffer[]) {
    return elements.reduce((layer, el, idx, arr) => {
      if (idx % 2 === 0) {
        // Hash the current element with its pair element
        layer.push(MerkleTree.combinedHash(el, arr[idx + 1]));
      }

      return layer;
    }, [] as Buffer[]);
  }

  static combinedHash(first: Buffer | null, second: Buffer | null) {
    if (!first) {
      if (!second) throw new Error('Missing second buffer');
      return second;
    }

    if (!second) {
      if (!first) throw new Error('Missing first buffer');
      return first;
    }

    return keccak256(MerkleTree._sortAndConcat(first, second));
  }

  getRoot() {
    return this.layers[this.layers.length - 1][0] as Buffer;
  }

  getHexRoot() {
    return bufferToHex(this.getRoot());
  }

  getProof(el: Buffer) {
    let idx = this.bufferElementPositionIndex[bufferToHex(el)];

    if (typeof idx !== 'number') {
      throw new Error('Element does not exist in Merkle tree');
    }

    return this.layers.reduce((proof: Buffer[], layer) => {
      const pairElement = MerkleTree._getPairElement(idx, layer as Buffer);

      if (pairElement) {
        proof.push(pairElement as unknown as Buffer);
      }

      idx = Math.floor(idx / 2);

      return proof;
    }, [] as Buffer[]);
  }

  getHexProof(el: Buffer) {
    const proof = this.getProof(el);
    return MerkleTree._bufArrToHexArr(proof);
  }

  static _getPairElement(idx: number, layer: Buffer) {
    const pairIdx = idx % 2 === 0 ? idx + 1 : idx - 1;

    if (pairIdx < layer.length) {
      return layer[pairIdx];
    } else {
      return null;
    }
  }

  static _bufDedup(elements: Buffer[]) {
    return elements.filter((el, idx) => {
      return idx === 0 || !elements[idx - 1].equals(el);
    });
  }

  static _bufArrToHexArr(arr: Buffer[]) {
    return arr.map((el) => '0x' + el.toString('hex'));
  }

  static _sortAndConcat(...args: Buffer[]) {
    return Buffer.concat([...args].sort(Buffer.compare));
  }
}
