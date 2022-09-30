//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../storage/ReducerStorage.sol";
import "../../interfaces/IReducerModule.sol";

contract ReducerModule is IReducerModule, ReducerStorage {
    constructor(address[] memory nodes) {
        _reducerStore().reducers = nodes;
    }

    function getPrice(nodeId) external returns (NodeData memory price) {
        // nodeId = keccak256(abi.encode(nodeDef));
       return proccss(nodeId);
    }

    function _processNode(NodeData[] memory prices) internal pure returns (NodeData memory price) {
        //logic with prices
        price = NodeData({price: 1, timestamp: 1, volatilityScore: 0, liquidityScore: 0});
    }

    function proccess(bytes32 nodeId) {
        address[] storage defs = _reducerStore().defs[nodeId];

        NodeData[] memory prices = new NodeData[](reducers.length);
        for (uint256 i = 0; i < reducers.length; i++) {
            NodeData memory result = IReducerModule(reducers[i]).getPrice();
            prices[i] = result;
        }

        // parameters?
        if(type === 'reducer') {
            // call reducer library
            return reducer(prices, parameters,)
        } 
        if(type === 'external' ) {
            // external library
            return external(...)
        }
        if(type === 'CB' ) {
            // external library
            return external(...)
        }
        
    }
}

[oracle1]   [oracle2]
    |
[reducer1]
    |
[reducer2]