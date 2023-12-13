//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@synthetixio/core-contracts/contracts/interfaces/IERC165.sol";
import {NodeDefinition} from "@synthetixio/oracle-manager/contracts/storage/NodeDefinition.sol";
import {NodeOutput} from "@synthetixio/oracle-manager/contracts/storage/NodeOutput.sol";

interface IPythChainlinkLidoExternalNode is IERC165 {
    function process(
        NodeOutput.Data[] memory prices,
        bytes memory parameters,
        bytes32[] memory runtimeKeys,
        bytes32[] memory runtimeValues
    ) external view returns (NodeOutput.Data memory nodeOutput);

    function isValid(NodeDefinition.Data memory nodeDefinition) external returns (bool valid);
}
