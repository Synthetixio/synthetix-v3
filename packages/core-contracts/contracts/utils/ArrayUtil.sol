//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library ArrayUtil {
    error ArrayValueNotFound(address element);

    function removeValue(address value, address[] storage array, mapping(address => uint) storage positions) internal {
        uint256 valuePosition = positions[value];
        if (valuePosition == 0) {
            revert ArrayValueNotFound(value);
        }

        uint256 valueIndex = valuePosition - 1;
        uint256 lastIndex = array.length - 1;

        // Swap value to be deleted with the last value in the array.
        if (lastIndex != valueIndex) {
            address lastValue = array[lastIndex];

            array[valueIndex] = lastvalue;
            positions[lastvalue] = valueIndex;
        }

        array.pop();

        delete positions[value];
    }
}
