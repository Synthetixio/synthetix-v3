// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {
    IExternalNode,
    NodeOutput,
    NodeDefinition
} from "@synthetixio/oracle-manager/contracts/interfaces/external/IExternalNode.sol";
import "./interfaces/ArbGasInfo.sol";

contract ArbGasPriceOracle is IExternalNode {
    function process(
        NodeOutput.Data[] memory,
        bytes memory parameters,
        bytes32[] memory runtimeKeys,
        bytes32[] memory runtimeValues
    ) external view returns (NodeOutput.Data memory nodeOutput) {
        revert("Not implemented");
    }

    function isValid(NodeDefinition.Data memory nodeDefinition) external view returns (bool valid) {
        revert("Not implemented");
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IExternalNode).interfaceId || interfaceId == this.supportsInterface.selector;
    }
}
