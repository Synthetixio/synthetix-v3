//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../storage/Node.sol";

/// @title interface for external node
interface IExternalNode {
    function process(
        Node.Data[] memory prices,
        bytes memory parameters
    ) external view returns (Node.Data memory);
}
