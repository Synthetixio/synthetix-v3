// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

import "../storage/NodeDefinition.sol";
import "../storage/NodeOutput.sol";

library PriceDeviationCircuitBreakerNode {
    using SafeCastU256 for uint256;

    error InvalidPrice();
    error DeviationToleranceExceeded(int256 deviation);

    function process(
        NodeOutput.Data[] memory parentNodeOutputs,
        bytes memory parameters
    ) internal pure returns (NodeOutput.Data memory) {
        uint256 deviationTolerance = abi.decode(parameters, (uint256));

        int256 primaryPrice = parentNodeOutputs[0].price;
        int256 fallbackPrice = parentNodeOutputs[1].price;

        if (primaryPrice == 0) {
            revert InvalidPrice();
        }

        if (primaryPrice != fallbackPrice) {
            int256 difference = abs(primaryPrice - fallbackPrice);
            if (deviationTolerance.toInt() < ((difference * 100) / primaryPrice)) {
                if (parentNodeOutputs.length > 2 && parentNodeOutputs[2].price != 0) {
                    return parentNodeOutputs[2];
                } else {
                    revert DeviationToleranceExceeded(difference / primaryPrice);
                }
            }
        }

        return parentNodeOutputs[0];
    }

    function abs(int256 x) private pure returns (int256) {
        return x >= 0 ? x : -x;
    }

    function validate(NodeDefinition.Data memory nodeDefinition) internal pure returns (bool) {
        // Must have 2-3 parents
        if (!(nodeDefinition.parents.length == 2 || nodeDefinition.parents.length == 3)) {
            return false;
        }

        // Must have correct length of parameters data
        if (nodeDefinition.parameters.length != 32) {
            return false;
        }

        return true;
    }
}
