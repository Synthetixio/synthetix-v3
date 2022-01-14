//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../utils/SetUtil.sol";

contract SetUtilMock {
    using SetUtil for SetUtil.Bytes32Set;

    SetUtil.Bytes32Set private _set;

    function add(bytes32 value) external {
        _set.add(value);
    }

    function remove(bytes32 value) external {
        _set.remove(value);
    }

    function contains(bytes32 value) external view returns (bool) {
        return _set.contains(value);
    }

    function length() external view returns (uint) {
        return _set.length();
    }

    function valueAt(uint position) external view returns (bytes32) {
        return _set.valueAt(position);
    }

    function values() external view returns (bytes32[] memory) {
        return _set.values();
    }
}
