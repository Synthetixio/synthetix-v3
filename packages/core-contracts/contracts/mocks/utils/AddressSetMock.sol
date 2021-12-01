//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../utils/AddressSet.sol";

contract AddressSetMock {
    AddressSet.Values private _values;
    bool public lastMockResult;

    function add(address value) external returns (bool) {
        lastMockResult = AddressSet.add(_values, value);
        return lastMockResult;
    }

    function remove(address value) external returns (bool) {
        lastMockResult = AddressSet.remove(_values, value);
        return lastMockResult;
    }

    function contains(address value) external view returns (bool) {
        return AddressSet.contains(_values, value);
    }

    function length() external view returns (uint) {
        return AddressSet.length(_values);
    }

    function at(uint256 index) external view returns (address) {
        return AddressSet.at(_values, index);
    }

    function values() external view returns (address[] memory) {
        return AddressSet.values(_values);
    }
}
