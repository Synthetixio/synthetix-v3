//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library AddressSet {
    struct Values {
        address[] values;
        mapping(address => uint256) indexes;
    }

    function add(Values storage set, address value) internal returns (bool) {
        if (!contains(set, value)) {
            set.values.push(value);
            // The value is stored at length-1, but we add 1 to all indexes
            // and use 0 as a sentinel value
            set.indexes[value] = set.values.length;
            return true;
        } else {
            return false;
        }
    }

    function remove(Values storage set, address value) internal returns (bool) {
        // We read and store the value's index to prevent multiple reads from the same storage slot
        uint256 valueIndex = set.indexes[value];

        if (valueIndex != 0) {
            // To delete an element from the _values array in O(1), we swap the element to delete with the last one in
            // the array, and then remove the last element (sometimes called as 'swap and pop').
            // This modifies the order of the array, as noted in {at}.

            uint256 toDeleteIndex = valueIndex - 1;
            uint256 lastIndex = set.values.length - 1;

            if (lastIndex != toDeleteIndex) {
                address lastvalue = set.values[lastIndex];

                // Move the last value to the index where the value to delete is
                set.values[toDeleteIndex] = lastvalue;
                // Update the index for the moved value
                set.indexes[lastvalue] = valueIndex; // Replace lastvalue's index to valueIndex
            }

            // Delete the slot where the moved value was stored
            set.values.pop();

            // Delete the index for the deleted slot
            delete set.indexes[value];

            return true;
        } else {
            return false;
        }
    }

    function contains(Values storage set, address value) internal view returns (bool) {
        return set.indexes[value] != 0;
    }

    function length(Values storage set) internal view returns (uint256) {
        return set.values.length;
    }

    function at(Values storage set, uint256 index) internal view returns (address) {
        return set.values[index];
    }

    function values(Values storage set) internal view returns (address[] memory) {
        return set.values;
    }
}
