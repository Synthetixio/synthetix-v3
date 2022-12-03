// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/Node.sol";

library ReducerNodeLibrary {
    error UnsupportedOperation(uint operation);

    enum Operations {
        MAX,
        MIN,
        MEAN,
        MEDIAN,
        RECENT
    }

    function process(Node.Data[] memory prices, bytes memory parameters) internal pure returns (Node.Data memory) {
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

        revert UnsupportedOperation(uint(operation));
    }

    function median(Node.Data[] memory prices) internal pure returns (Node.Data memory medianPrice) {
        quickSort(prices, int(0), int(prices.length - 1));
        return prices[uint(prices.length / 2)];
    }

    function mean(Node.Data[] memory prices) internal pure returns (Node.Data memory meanPrice) {
        for (uint256 i = 0; i < prices.length; i++) {
            meanPrice.price += prices[i].price;
            meanPrice.timestamp += prices[i].timestamp;
        }

        meanPrice.price = meanPrice.price / int(prices.length);
        meanPrice.timestamp = meanPrice.timestamp / prices.length;
    }

    function recent(Node.Data[] memory prices) internal pure returns (Node.Data memory recentPrice) {
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

    function quickSort(
        Node.Data[] memory arr,
        int left,
        int right
    ) internal pure {
        int i = left;
        int j = right;
        if (i == j) return;
        int pivot = arr[uint(left + (right - left) / 2)].price;
        while (i <= j) {
            while (arr[uint(i)].price < pivot) i++;
            while (pivot < arr[uint(j)].price) j--;
            if (i <= j) {
                (arr[uint(i)], arr[uint(j)]) = (arr[uint(j)], arr[uint(i)]);
                i++;
                j--;
            }
        }
        if (left < j) quickSort(arr, left, j);
        if (i < right) quickSort(arr, i, right);
    }
}
