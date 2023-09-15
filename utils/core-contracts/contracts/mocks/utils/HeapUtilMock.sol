//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

pragma experimental ABIEncoderV2;
import "../../utils/HeapUtil.sol";

// this is a simple contract that uses the heap library.
// https://github.com/zmitton/eth-heap/blob/master/contracts/PublicHeap.sol
contract HeapUtilMock {
    using HeapUtil for HeapUtil.Data;

    HeapUtil.Data public data;

    constructor() {
        data.init();
    }

    function insert(uint128 id, int128 priority) public returns (HeapUtil.Node memory) {
        return data.insert(id, priority);
    }

    function extractMax() public returns (HeapUtil.Node memory) {
        return data.extractMax();
    }

    function extractById(uint128 id) public returns (HeapUtil.Node memory) {
        return data.extractById(id);
    }

    //view
    function dump() public view returns (HeapUtil.Node[] memory) {
        return data.dump();
    }

    function getMax() public view returns (HeapUtil.Node memory) {
        return data.getMax();
    }

    function getById(uint128 id) public view returns (HeapUtil.Node memory) {
        return data.getById(id);
    }

    function getByIndex(uint i) public view returns (HeapUtil.Node memory) {
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
