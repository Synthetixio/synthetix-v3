// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "../storage/NodeFactoryStorage.sol";

library ReducerNodeLibrary {
    enum Operations {
        MAX,
        MIN,
        MEAN,
        MEDIAN,
        RECENT
    }

    function process(NodeFactoryStorage.NodeData[] memory prices, bytes memory parameters)
        internal
        pure
        returns (NodeFactoryStorage.NodeData memory)
    {
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
        // checks parameters and call the relevant function
        // parameters[0] == Operations.MAX
        //  uint price;
        // uint timestamp;
        // uint volatilityScore;
        // uint liquidityScore;
        // [priceAction, timestampAction, volatilityScoreAction, liquidityScoreAction] = parameters;
        // NodeFactoryStorage.NodeData memory output;
        // for(uint i = 0; i < prices.length; i++) {
        //     if(parameters[0] == Operations.MAX) {
        //         output.price =
        //     }
        // }
        // output.price = 1000 uniswap;
        // output.timestamp = 10 chainlinks;
        // return output;
    }

    function median(NodeFactoryStorage.NodeData[] memory prices)
        internal
        pure
        returns (NodeFactoryStorage.NodeData memory medianPrice)
    {
        quickSort(prices, int(0), int(prices.length - 1));
        return prices[uint(prices.length / 2)];
    }

    function mean(NodeFactoryStorage.NodeData[] memory prices)
        internal
        pure
        returns (NodeFactoryStorage.NodeData memory meanPrice)
    {
        for (uint256 i = 0; i < prices.length; i++) {
            meanPrice.price += prices[i].price;
            meanPrice.timestamp += prices[i].timestamp;
        }

        meanPrice.price = meanPrice.price / int(prices.length);
        meanPrice.timestamp = meanPrice.timestamp / prices.length;
    }

    function recent(NodeFactoryStorage.NodeData[] memory prices)
        internal
        pure
        returns (NodeFactoryStorage.NodeData memory recentPrice)
    {
        for (uint256 i = 0; i < prices.length; i++) {
            if (prices[i].timestamp > recentPrice.timestamp) {
                recentPrice = prices[i];
            }
        }
    }

    function max(NodeFactoryStorage.NodeData[] memory prices)
        internal
        pure
        returns (NodeFactoryStorage.NodeData memory maxPrice)
    {
        for (uint256 i = 0; i < prices.length; i++) {
            if (prices[i].price > maxPrice.price) {
                maxPrice = prices[i];
            }
        }
    }

    function min(NodeFactoryStorage.NodeData[] memory prices)
        internal
        pure
        returns (NodeFactoryStorage.NodeData memory minPrice)
    {
        minPrice = prices[0];
        for (uint256 i = 0; i < prices.length; i++) {
            if (prices[i].price < minPrice.price) {
                minPrice = prices[i];
            }
        }
    }

    function quickSort(
        NodeFactoryStorage.NodeData[] memory arr,
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
