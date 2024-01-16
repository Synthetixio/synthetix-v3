// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";

import "../storage/NodeDefinition.sol";
import "../storage/NodeOutput.sol";

library ReducerNode {
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;
    using DecimalMath for int256;

    error UnsupportedOperation(Operations operation);
    error InvalidPrice(int256 price);

    enum Operations {
        RECENT,
        MIN,
        MAX,
        MEAN,
        MEDIAN,
        MUL,
        DIV,
        MULDECIMAL,
        DIVDECIMAL
    }

    function process(
        NodeOutput.Data[] memory parentNodeOutputs,
        bytes memory parameters
    ) internal pure returns (NodeOutput.Data memory nodeOutput) {
        Operations operation = abi.decode(parameters, (Operations));

        if (operation == Operations.RECENT) {
            return recent(parentNodeOutputs);
        }
        if (operation == Operations.MIN) {
            return min(parentNodeOutputs);
        }
        if (operation == Operations.MAX) {
            return max(parentNodeOutputs);
        }
        if (operation == Operations.MEAN) {
            return mean(parentNodeOutputs);
        }
        if (operation == Operations.MEDIAN) {
            return median(parentNodeOutputs);
        }
        if (operation == Operations.MUL) {
            return mul(parentNodeOutputs);
        }
        if (operation == Operations.DIV) {
            return div(parentNodeOutputs);
        }
        if (operation == Operations.MULDECIMAL) {
            return mulDecimal(parentNodeOutputs);
        }
        if (operation == Operations.DIVDECIMAL) {
            return divDecimal(parentNodeOutputs);
        }

        revert UnsupportedOperation(operation);
    }

    function median(
        NodeOutput.Data[] memory parentNodeOutputs
    ) internal pure returns (NodeOutput.Data memory medianPrice) {
        quickSort(parentNodeOutputs, SafeCastI256.zero(), (parentNodeOutputs.length - 1).toInt());
        if (parentNodeOutputs.length % 2 == 0) {
            NodeOutput.Data[] memory middleSet = new NodeOutput.Data[](2);
            middleSet[0] = parentNodeOutputs[(parentNodeOutputs.length / 2) - 1];
            middleSet[1] = parentNodeOutputs[(parentNodeOutputs.length / 2)];
            return mean(middleSet);
        } else {
            return parentNodeOutputs[parentNodeOutputs.length / 2];
        }
    }

    function mean(
        NodeOutput.Data[] memory parentNodeOutputs
    ) internal pure returns (NodeOutput.Data memory meanPrice) {
        for (uint256 i = 0; i < parentNodeOutputs.length; i++) {
            meanPrice.price += parentNodeOutputs[i].price;
            meanPrice.timestamp += parentNodeOutputs[i].timestamp;
        }

        meanPrice.price = meanPrice.price / parentNodeOutputs.length.toInt();
        meanPrice.timestamp = meanPrice.timestamp / parentNodeOutputs.length;
    }

    function recent(
        NodeOutput.Data[] memory parentNodeOutputs
    ) internal pure returns (NodeOutput.Data memory recentPrice) {
        for (uint256 i = 0; i < parentNodeOutputs.length; i++) {
            if (parentNodeOutputs[i].timestamp > recentPrice.timestamp) {
                recentPrice = parentNodeOutputs[i];
            }
        }
    }

    function max(
        NodeOutput.Data[] memory parentNodeOutputs
    ) internal pure returns (NodeOutput.Data memory maxPrice) {
        maxPrice = parentNodeOutputs[0];
        for (uint256 i = 1; i < parentNodeOutputs.length; i++) {
            if (parentNodeOutputs[i].price > maxPrice.price) {
                maxPrice = parentNodeOutputs[i];
            }
        }
    }

    function min(
        NodeOutput.Data[] memory parentNodeOutputs
    ) internal pure returns (NodeOutput.Data memory minPrice) {
        minPrice = parentNodeOutputs[0];
        for (uint256 i = 1; i < parentNodeOutputs.length; i++) {
            if (parentNodeOutputs[i].price < minPrice.price) {
                minPrice = parentNodeOutputs[i];
            }
        }
    }

    function mul(
        NodeOutput.Data[] memory parentNodeOutputs
    ) internal pure returns (NodeOutput.Data memory mulPrice) {
        mulPrice.price = parentNodeOutputs[0].price;
        mulPrice.timestamp = parentNodeOutputs[0].timestamp;
        for (uint256 i = 1; i < parentNodeOutputs.length; i++) {
            mulPrice.price *= parentNodeOutputs[i].price;
            mulPrice.timestamp += parentNodeOutputs[i].timestamp;
        }
        mulPrice.timestamp = mulPrice.timestamp / parentNodeOutputs.length;
    }

    function div(
        NodeOutput.Data[] memory parentNodeOutputs
    ) internal pure returns (NodeOutput.Data memory divPrice) {
        divPrice.price = parentNodeOutputs[0].price;
        divPrice.timestamp = parentNodeOutputs[0].timestamp;
        for (uint256 i = 1; i < parentNodeOutputs.length; i++) {
            if (parentNodeOutputs[i].price == 0) {
                revert InvalidPrice(parentNodeOutputs[i].price);
            }
            divPrice.price /= parentNodeOutputs[i].price;
            divPrice.timestamp += parentNodeOutputs[i].timestamp;
        }
        divPrice.timestamp = divPrice.timestamp / parentNodeOutputs.length;
    }

    function mulDecimal(
        NodeOutput.Data[] memory parentNodeOutputs
    ) internal pure returns (NodeOutput.Data memory mulPrice) {
        mulPrice.price = parentNodeOutputs[0].price;
        mulPrice.timestamp = parentNodeOutputs[0].timestamp;
        for (uint256 i = 1; i < parentNodeOutputs.length; i++) {
            mulPrice.price = mulPrice.price.mulDecimal(parentNodeOutputs[i].price);
            mulPrice.timestamp += parentNodeOutputs[i].timestamp;
        }
        mulPrice.timestamp = mulPrice.timestamp / parentNodeOutputs.length;
    }

    function divDecimal(
        NodeOutput.Data[] memory parentNodeOutputs
    ) internal pure returns (NodeOutput.Data memory divPrice) {
        divPrice.price = parentNodeOutputs[0].price;
        divPrice.timestamp = parentNodeOutputs[0].timestamp;
        for (uint256 i = 1; i < parentNodeOutputs.length; i++) {
            if (parentNodeOutputs[i].price == 0) {
                revert InvalidPrice(parentNodeOutputs[i].price);
            }
            divPrice.price = divPrice.price.divDecimal(parentNodeOutputs[i].price);
            divPrice.timestamp += parentNodeOutputs[i].timestamp;
        }
        divPrice.timestamp = divPrice.timestamp / parentNodeOutputs.length;
    }

    function quickSort(NodeOutput.Data[] memory arr, int256 left, int256 right) internal pure {
        int256 i = left;
        int256 j = right;
        if (i == j) return;
        int256 pivot = arr[(left + (right - left) / 2).toUint()].price;
        while (i <= j) {
            while (arr[i.toUint()].price < pivot) i++;
            while (pivot < arr[j.toUint()].price) j--;
            if (i <= j) {
                (arr[i.toUint()], arr[j.toUint()]) = (arr[j.toUint()], arr[i.toUint()]);
                i++;
                j--;
            }
        }
        if (left < j) quickSort(arr, left, j);
        if (i < right) quickSort(arr, i, right);
    }

    function isValid(NodeDefinition.Data memory nodeDefinition) internal pure returns (bool valid) {
        // Must have at least 2 parents
        if (nodeDefinition.parents.length < 2) {
            return false;
        }

        // Must have correct length of parameters data
        if (nodeDefinition.parameters.length != 32) {
            return false;
        }

        // Must have valid operation
        uint256 operationId = abi.decode(nodeDefinition.parameters, (uint256));
        if (operationId > 8) {
            return false;
        }

        return true;
    }
}
