//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../storage/OracleManagerStorage.sol";

/// @title interface for external node
interface IExternalNode {
    function process(OracleManagerStorage.NodeData[] memory prices, bytes memory parameters)
        external
        returns (OracleManagerStorage.NodeData memory);
}
