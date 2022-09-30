// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "../storage/NodeFactoryStorage.sol";

library ExternalNodeLibrary {
    function proccess(NodeFactoryStorage.NodeData[] memory prices, bytes memory parameters)
        internal
        pure
        returns (NodeFactoryStorage.NodeData memory)
    {
        // checks parameters and call the relevant function
        // parameters[0] = addres
        // [...]
        return getPrice(prices);
    }

    function getPrice(NodeFactoryStorage.NodeData[] memory prices)
        internal
        pure
        returns (NodeFactoryStorage.NodeData memory price)
    {
        // finds the max price
        price = prices[0];
    }
}
