// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../storage/NodeDefinition.sol";
import "../storage/NodeOutput.sol";

library ConstantNode {
    function process(
        bytes memory parameters
    ) internal view returns (NodeOutput.Data memory nodeOutput) {
        return NodeOutput.Data(abi.decode(parameters, (int256)), block.timestamp, 0, 0);
    }

    function isValid(NodeDefinition.Data memory nodeDefinition) internal pure returns (bool valid) {
        // Must have no parents
        if (nodeDefinition.parents.length > 0) {
            return false;
        }

        // Must have correct length of parameters data
        if (nodeDefinition.parameters.length < 32) {
            return false;
        }

        return true;
    }
}
