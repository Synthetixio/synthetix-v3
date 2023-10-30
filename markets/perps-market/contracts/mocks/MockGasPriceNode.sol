// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "@synthetixio/oracle-manager/contracts/interfaces/external/IExternalNode.sol";

contract MockGasPriceNode is IExternalNode {
    NodeOutput.Data private output;

    uint256 public constant KIND_SETTLEMENT = 0;
    uint256 public constant KIND_LIQUIDATION_ELIGIBILITY = 1;
    uint256 public constant KIND_FLAG = 2;
    uint256 public constant KIND_LIQUIDATE = 3;

    int public settlementCost;
    int public flagCost;
    int public liquidateCost;
    int public elegibilityCost;

    constructor() {}

    function setCosts(
        int _settlementCost,
        int _flagCost,
        int _liquidateCost,
        int _elegibilityCost
    ) external {
        settlementCost = _settlementCost;
        flagCost = _flagCost;
        liquidateCost = _liquidateCost;
        elegibilityCost = _elegibilityCost;
    }

    function process(
        NodeOutput.Data[] memory,
        bytes memory,
        bytes32[] memory runtimeKeys,
        bytes32[] memory runtimeValues
    ) external view override returns (NodeOutput.Data memory) {
        NodeOutput.Data memory theOutput = output;

        for (uint256 i = 0; i < runtimeKeys.length; i++) {
            if (runtimeKeys[i] == "executionKind") {
                // solhint-disable-next-line numcast/safe-cast
                uint256 executionKind = uint256(runtimeValues[i]);
                if (executionKind == KIND_SETTLEMENT) {
                    theOutput.price = settlementCost;
                } else if (executionKind == KIND_LIQUIDATION_ELIGIBILITY) {
                    theOutput.price = elegibilityCost;
                } else if (executionKind == KIND_FLAG) {
                    theOutput.price = flagCost;
                } else if (executionKind == KIND_LIQUIDATE) {
                    theOutput.price = liquidateCost;
                } else {
                    revert("Invalid execution kind");
                }
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
