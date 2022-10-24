//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../storage/NodeData.sol";

/// @title interface for external node
interface IExternalNode {
    function process(NodeData.Data[] memory prices, bytes memory parameters)
        external
        view
        returns (NodeData.Data memory);
}
