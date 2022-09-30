//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../storage/ReducerStorage.sol";
import "../../interfaces/IReducerModule.sol";

contract ReducerModule is IReducerModule, ReducerStorage {
    // function configure(NodeDefenition storage nodeDefStorage) {
        
    // } 

    function getPrice(uint[] memory parameters, NodeData[] memory prices) external returns (NodeData memory price) {
        // address[] storage reducers = _reducerStore().reducers;
        // NodeData[] memory prices = new NodeData[](reducers.length);
        // for (uint256 i = 0; i < reducers.length; i++) {
        //     NodeData memory result = IReducerModule(reducers[i]).getPrice();
        //     prices[i] = result;
        // }
        // price = _processNode(prices);
        switch()
    }

    function _processNode(NodeData[] memory prices) internal pure returns (NodeData memory price) {
        //logic with prices
        price = NodeData({price: 1, timestamp: 1, volatilityScore: 0, liquidityScore: 0});
    }
}
