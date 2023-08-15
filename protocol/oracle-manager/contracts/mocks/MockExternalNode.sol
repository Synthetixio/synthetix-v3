// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "../interfaces/external/IExternalNode.sol";

contract MockExternalNode is IExternalNode {
    NodeOutput.Data private output;

    constructor(int256 price, uint256 timestamp) {
        output.price = price;
        output.timestamp = timestamp;
    }

    function process(
        NodeOutput.Data[] memory,
        bytes memory,
        bytes32[] memory runtimeKeys,
        bytes32[] memory runtimeValues
    ) external view override returns (NodeOutput.Data memory) {
        NodeOutput.Data memory theOutput = output;

        for (uint256 i = 0; i < runtimeKeys.length; i++) {
            if (runtimeKeys[i] == "overridePrice") {
                // solhint-disable-next-line numcast/safe-cast
                theOutput.price = int256(uint256(runtimeValues[i]));
            }
        }
        return theOutput;
    }

    function isValid(
        NodeDefinition.Data memory nodeDefinition
    ) external pure override returns (bool) {
        return nodeDefinition.nodeType == NodeDefinition.NodeType.EXTERNAL;
    }

    function supportsInterface(bytes4) public view virtual override(IERC165) returns (bool) {
        return true;
    }
}
