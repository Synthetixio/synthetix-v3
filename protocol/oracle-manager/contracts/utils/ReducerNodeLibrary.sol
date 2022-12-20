// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "../storage/Node.sol";

library ReducerNodeLibrary {
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;

    error UnsupportedOperation(uint256 operation);

    enum Operations {
        MAX,
        MIN,
        MEAN,
        MEDIAN,
        RECENT
    }

    function process(
        Node.Data[] memory prices,
        bytes memory parameters
    ) internal pure returns (Node.Data memory) {
        Operations operation = abi.decode(parameters, (Operations));

        if (operation == Operations.MAX) {
            return max(prices);
        }
        if (operation == Operations.MIN) {
            return min(prices);
        }
        if (operation == Operations.MEAN) {
            return mean(prices);
        }
        if (operation == Operations.MEDIAN) {
            return median(prices);
        }
        if (operation == Operations.RECENT) {
            return recent(prices);
        }

        revert UnsupportedOperation(uint256(operation));
    }

    function median(
        Node.Data[] memory prices
    ) internal pure returns (Node.Data memory medianPrice) {
        quickSort(prices, 0, (prices.length - 1).toInt());
        return prices[(prices.length / 2)];
    }

    function mean(Node.Data[] memory prices) internal pure returns (Node.Data memory meanPrice) {
        for (uint256 i = 0; i < prices.length; i++) {
            meanPrice.price += prices[i].price;
            meanPrice.timestamp += prices[i].timestamp;
        }

        meanPrice.price = meanPrice.price / prices.length.toInt();
        meanPrice.timestamp = meanPrice.timestamp / prices.length;
    }

    function recent(
        Node.Data[] memory prices
    ) internal pure returns (Node.Data memory recentPrice) {
        for (uint256 i = 0; i < prices.length; i++) {
            if (prices[i].timestamp > recentPrice.timestamp) {
                recentPrice = prices[i];
            }
        }
    }

    function max(Node.Data[] memory prices) internal pure returns (Node.Data memory maxPrice) {
        for (uint256 i = 0; i < prices.length; i++) {
            if (prices[i].price > maxPrice.price) {
                maxPrice = prices[i];
            }
        }
    }

    function min(Node.Data[] memory prices) internal pure returns (Node.Data memory minPrice) {
        minPrice = prices[0];
        for (uint256 i = 0; i < prices.length; i++) {
            if (prices[i].price < minPrice.price) {
                minPrice = prices[i];
            }
        }
    }

    function quickSort(Node.Data[] memory arr, int256 left, int256 right) internal pure {
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
}
