// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "../storage/NodeFactoryStorage.sol";

library ReducerNodeLibrary {
    enum Operations {
        MAX,
        MIN
    }

    function process(NodeFactoryStorage.NodeData[] memory prices, bytes memory parameters)
        internal
        pure
        returns (NodeFactoryStorage.NodeData memory)
    {
        Operations operation = abi.decode(parameters, (Operations));
        if (operation == Operations.MAX) {
            return max(prices);
        }
        if (operation == Operations.MIN) {
            return min(prices);
        }
        // checks parameters and call the relevant function
        // parameters[0] == Operations.MAX
        //  uint price;
        // uint timestamp;
        // uint volatilityScore;
        // uint liquidityScore;
        // [priceAction, timestampAction, volatilityScoreAction, liquidityScoreAction] = parameters;
        // NodeFactoryStorage.NodeData memory output;
        // for(uint i = 0; i < prices.length; i++) {
        //     if(parameters[0] == Operations.MAX) {
        //         output.price =
        //     }
        // }
        // output.price = 1000 uniswap;
        // output.timestamp = 10 chainlinks;
        // return output;
    }

    function max(NodeFactoryStorage.NodeData[] memory prices)
        internal
        pure
        returns (NodeFactoryStorage.NodeData memory maxPrice)
    {
        for (uint256 i = 0; i < prices.length; i++) {
            if (prices[i].price > maxPrice.price) {
                maxPrice = prices[i];
            }
        }
        return maxPrice;
    }

    function min(NodeFactoryStorage.NodeData[] memory prices)
        internal
        pure
        returns (NodeFactoryStorage.NodeData memory minPrice)
    {
        minPrice = prices[0];
        for (uint256 i = 0; i < prices.length; i++) {
            if (prices[i].price < minPrice.price) {
                minPrice = prices[i];
            }
        }
        return minPrice;
    }
}
