// pragma solidity 0.4.24;
pragma experimental ABIEncoderV2;
import "../utils/Heap.sol";

// this is a simple contract that uses the heap library.
// https://github.com/zmitton/eth-heap/blob/master/contracts/PublicHeap.sol
contract MockHeap {
    using Heap for Heap.Data;
    Heap.Data public data;

    constructor() public {
        data.init();
    }

    function insert(uint128 id, int128 priority) public returns (Heap.Node memory) {
        return data.insert(id, priority);
    }

    function extractMax() public returns (Heap.Node memory) {
        return data.extractMax();
    }

    function extractById(uint128 id) public returns (Heap.Node memory) {
        return data.extractById(id);
    }

    //view
    function dump() public view returns (Heap.Node[] memory) {
        return data.dump();
    }

    function getMax() public view returns (Heap.Node memory) {
        return data.getMax();
    }

    function getById(uint128 id) public view returns (Heap.Node memory) {
        return data.getById(id);
    }

    function getByIndex(uint i) public view returns (Heap.Node memory) {
        return data.getByIndex(i);
    }

    function size() public view returns (uint) {
        return data.size();
    }

    function idCount() public view returns (uint128) {
        return data.idCount;
    }

    function indices(uint128 id) public view returns (uint) {
        return data.indices[id];
    }
}
