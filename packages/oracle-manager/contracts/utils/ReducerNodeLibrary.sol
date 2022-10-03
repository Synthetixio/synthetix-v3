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
        returns (NodeFactoryStorage.NodeData memory price)
    {
        // exp: finds the max price
        price = prices[0];
    }
}
