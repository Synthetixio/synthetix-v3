// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "../storage/NodeFactoryStorage.sol";
import "../interfaces/external/IAggregatorV3Interface.sol";

library ChainlinkNodeLibrary {
    function process(NodeFactoryStorage.NodeData[] memory, bytes memory parameters)
        internal
        view
        returns (NodeFactoryStorage.NodeData memory)
    {
        IAggregatorV3Interface chainlinkAggr = IAggregatorV3Interface(abi.decode(parameters, (address)));
        (, int256 price, , uint256 updatedAt, ) = chainlinkAggr.latestRoundData();
        return NodeFactoryStorage.NodeData(uint(price), updatedAt, 0, 0);
    }
}
