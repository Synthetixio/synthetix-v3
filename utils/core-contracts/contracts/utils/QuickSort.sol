//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

// taken and modified from: https://gist.github.com/subhodi/b3b86cc13ad2636420963e692a4d896f

library QuickSort {
    /**
     * Sorts the given data in-place using the quicksort algorithm https://en.wikipedia.org/wiki/Quicksort
     * @return result The data param, sorted in place.
     * @return sidecar Additionally, returns `sidecar`, which can be used to map any other data to the sorted values
     */
    function sort(
        bytes32[] memory data
    ) internal pure returns (bytes32[] memory result, uint256[] memory sidecar) {
        sidecar = new uint256[](data.length);
        for (uint256 i = 0; i < data.length; i++) {
            sidecar[i] = i;
        }
        quickSort(data, sidecar, 0, int256(data.length - 1));
        result = data;
    }

    /**
     * Internal recursive function which sorts the actual data.
     * @notice generally do not call this directly. Instead, call `sort`
     */
    function quickSort(
        bytes32[] memory arr,
        uint256[] memory sidecar,
        int256 left,
        int256 right
    ) internal pure {
        int256 i = left;
        int256 j = right;
        if (i == j) return;
        bytes32 pivot = arr[uint256(left + (right - left) / 2)];
        while (i <= j) {
            while (arr[uint256(i)] < pivot) i++;
            while (pivot < arr[uint256(j)]) j--;
            if (i <= j) {
                (arr[uint256(i)], arr[uint256(j)]) = (arr[uint256(j)], arr[uint(i)]);
                (sidecar[uint256(i)], sidecar[uint256(j)]) = (
                    sidecar[uint256(j)],
                    sidecar[uint(i)]
                );
                i++;
                j--;
            }
        }
        if (left < j) quickSort(arr, sidecar, left, j);
        if (i < right) quickSort(arr, sidecar, i, right);
    }
}
