//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../storage/NodeFactoryStorage.sol";

/// @title interface for external node
interface IExternalNode {
    function process(NodeFactoryStorage.NodeData[] memory prices, bytes memory parameters)
        external
        view
        returns (NodeFactoryStorage.NodeData memory);
}
