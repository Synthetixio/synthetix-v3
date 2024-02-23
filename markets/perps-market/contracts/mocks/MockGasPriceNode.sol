// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "@synthetixio/oracle-manager/contracts/interfaces/external/IExternalNode.sol";

contract MockGasPriceNode is IExternalNode {
    NodeOutput.Data private output;

    uint256 public constant KIND_SETTLEMENT = 0;
    uint256 public constant KIND_FLAG = 1;
    uint256 public constant KIND_LIQUIDATE = 2;

    uint256 public settlementCost;
    uint256 public flagCost;
    uint256 public liquidateCost;

    constructor() {}

    function setCosts(uint256 _settlementCost, uint256 _flagCost, uint256 _liquidateCost) external {
        settlementCost = _settlementCost;
        flagCost = _flagCost;
        liquidateCost = _liquidateCost;
    }

    // solhint-disable numcast/safe-cast
    function process(
        NodeOutput.Data[] memory,
        bytes memory,
        bytes32[] memory runtimeKeys,
        bytes32[] memory runtimeValues
    ) external view override returns (NodeOutput.Data memory) {
        NodeOutput.Data memory theOutput = output;
        uint256 executionKind;
        uint256 numberOfUpdatedFeeds;
        for (uint256 i = 0; i < runtimeKeys.length; i++) {
            if (runtimeKeys[i] == "executionKind") {
                executionKind = uint256(runtimeValues[i]);
                continue;
            }
            if (runtimeKeys[i] == "numberOfUpdatedFeeds") {
                numberOfUpdatedFeeds = uint256(runtimeValues[i]);
                continue;
            }
        }

        if (executionKind == KIND_SETTLEMENT) {
            theOutput.price = int256(settlementCost);
        } else if (executionKind == KIND_FLAG) {
            theOutput.price = int256(flagCost * numberOfUpdatedFeeds);
        } else if (executionKind == KIND_LIQUIDATE) {
            theOutput.price = int256(liquidateCost);
        } else {
            revert("Invalid execution kind");
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
