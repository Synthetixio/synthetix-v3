//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library ArrayUtil {
    error ArrayValueNotFound(address value);

    function removeValue(
        address value,
        address[] storage array,
        mapping(address => uint) storage positions
    ) internal {
        uint valuePosition = positions[value];
        if (valuePosition == 0) {
            revert ArrayValueNotFound(value);
        }

        uint valueIndex = valuePosition - 1;
        uint lastIndex = array.length - 1;

        // Swap value to be deleted with the last value in the array.
        if (lastIndex != valueIndex) {
            address lastValue = array[lastIndex];

            array[valueIndex] = lastValue;
            positions[lastValue] = valuePosition;
        }

        array.pop();

        delete positions[value];
    }

    function hasDuplicates(address[] memory array) internal pure returns (bool) {
        uint length = array.length;

        for (uint i = 0; i < length; i++) {
            address value = array[i];

            if (i < length - 1) {
                for (uint256 j = i + 1; j < length; j++) {
                    address otherValue = array[j];

                    if (value == otherValue) {
                        return true;
                    }
                }
            }
        }

        return false;
    }
}
