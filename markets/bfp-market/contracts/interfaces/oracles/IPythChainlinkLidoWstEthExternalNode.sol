//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IERC165} from "@synthetixio/core-contracts/contracts/interfaces/IERC165.sol";
import {NodeDefinition} from "@synthetixio/oracle-manager/contracts/storage/NodeDefinition.sol";
import {NodeOutput} from "@synthetixio/oracle-manager/contracts/storage/NodeOutput.sol";

interface IPythChainlinkLidoWstEthExternalNode is IERC165 {
    /**
     * @notice Returns the wstETH price given supplied parameters using Pyth, CL, and Lido.
     */
    function process(
        bytes memory parameters,
        bytes32[] memory runtimeKeys,
        bytes32[] memory runtimeValues
    ) external view returns (NodeOutput.Data memory nodeOutput);

    /**
     * @notice Returns true if the provided `nodeDefinition` complies with this node. False otherwise.
     */
    function isValid(NodeDefinition.Data memory nodeDefinition) external view returns (bool valid);
}
