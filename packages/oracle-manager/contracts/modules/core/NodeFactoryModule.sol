//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../storage/ReducerStorage.sol";
import "../../interfaces/IReducerModule.sol";

contract NodeFactoryModule is IReducerModule, ReducerStorage {
    constructor(address[] memory nodes) {
        _reducerStore().reducers = nodes;
    }

    function createNode(nodeDef: NodeDefenition) external returns () {
        id = keccak256(abi.encode(nodeDef));
        returns id;
    }
}