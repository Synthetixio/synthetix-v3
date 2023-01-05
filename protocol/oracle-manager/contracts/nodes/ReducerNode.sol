// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

import "../storage/NodeOutput.sol";

library ReducerNode {
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;

    error UnsupportedOperation(Operations operation);

    enum Operations {
        RECENT,
        MIN,
        MAX,
        MEAN,
        MEDIAN,
        MUL,
        DIV
    }

    function process(
        NodeOutput.Data[] memory nodeOutput,
        bytes memory parameters
    ) internal pure returns (NodeOutput.Data memory) {
        Operations operation = abi.decode(parameters, (Operations));

        if (operation == Operations.RECENT) {
            return recent(nodeOutput);
        }
        if (operation == Operations.MIN) {
            return min(nodeOutput);
        }
        if (operation == Operations.MAX) {
            return max(nodeOutput);
        }
        if (operation == Operations.MEAN) {
            return mean(nodeOutput);
        }
        if (operation == Operations.MEDIAN) {
            return median(nodeOutput);
        }
        if (operation == Operations.MUL) {
            return mul(nodeOutput);
        }
        if (operation == Operations.DIV) {
            return div(nodeOutput);
        }

        revert UnsupportedOperation(operation);
    }

    function median(
        NodeOutput.Data[] memory nodeOutput
    ) internal pure returns (NodeOutput.Data memory medianPrice) {
        // Should MEAN the two in the middle if uneven
        quickSort(nodeOutput, SafeCastI256.zero(), (nodeOutput.length - 1).toInt());
        return nodeOutput[nodeOutput.length / 2];
    }

    function mean(
        NodeOutput.Data[] memory nodeOutput
    ) internal pure returns (NodeOutput.Data memory meanPrice) {
        for (uint256 i = 0; i < nodeOutput.length; i++) {
            meanPrice.price += nodeOutput[i].price;
            meanPrice.timestamp += nodeOutput[i].timestamp;
        }

        meanPrice.price = meanPrice.price / nodeOutput.length.toInt();
        meanPrice.timestamp = meanPrice.timestamp / nodeOutput.length;
    }

    function recent(
        NodeOutput.Data[] memory nodeOutput
    ) internal pure returns (NodeOutput.Data memory recentPrice) {
        for (uint256 i = 0; i < nodeOutput.length; i++) {
            if (nodeOutput[i].timestamp > recentPrice.timestamp) {
                recentPrice = nodeOutput[i];
            }
        }
    }

    function max(
        NodeOutput.Data[] memory nodeOutput
    ) internal pure returns (NodeOutput.Data memory maxPrice) {
        for (uint256 i = 0; i < nodeOutput.length; i++) {
            if (nodeOutput[i].price > maxPrice.price) {
                maxPrice = nodeOutput[i];
            }
        }
    }

    function min(
        NodeOutput.Data[] memory nodeOutput
    ) internal pure returns (NodeOutput.Data memory minPrice) {
        minPrice = nodeOutput[0];
        for (uint256 i = 0; i < nodeOutput.length; i++) {
            if (nodeOutput[i].price < minPrice.price) {
                minPrice = nodeOutput[i];
            }
        }
    }

    function mul(
        NodeOutput.Data[] memory nodeOutput
    ) internal pure returns (NodeOutput.Data memory mulPrice) {
        // TODO
    }

    function div(
        NodeOutput.Data[] memory nodeOutput
    ) internal pure returns (NodeOutput.Data memory divPrice) {
        // TODO
    }

    function quickSort(NodeOutput.Data[] memory arr, int left, int right) internal pure {
        int i = left;
        int j = right;
        if (i == j) return;
        int pivot = arr[(left + (right - left) / 2).toUint()].price;
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
}
