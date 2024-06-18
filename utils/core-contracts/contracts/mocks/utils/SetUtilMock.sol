//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../../utils/SetUtil.sol";

contract Bytes32SetMock {
    using SetUtil for SetUtil.Bytes32Set;

    SetUtil.Bytes32Set private _set;

    function add(bytes32 value) external {
        _set.add(value);
    }

    function remove(bytes32 value) external {
        _set.remove(value);
    }

    function replace(bytes32 value, bytes32 newValue) external {
        _set.replace(value, newValue);
    }

    function contains(bytes32 value) external view returns (bool) {
        return _set.contains(value);
    }

    function length() external view returns (uint256) {
        return _set.length();
    }

    function valueAt(uint256 position) external view returns (bytes32) {
        return _set.valueAt(position);
    }

    function positionOf(bytes32 value) external view returns (uint256) {
        return _set.positionOf(value);
    }

    function values() external view returns (bytes32[] memory) {
        return _set.values();
    }
}

contract AddressSetMock {
    using SetUtil for SetUtil.AddressSet;

    SetUtil.AddressSet private _set;

    function add(address value) external {
        _set.add(value);
    }

    function remove(address value) external {
        _set.remove(value);
    }

    function replace(address value, address newValue) external {
        _set.replace(value, newValue);
    }

    function contains(address value) external view returns (bool) {
        return _set.contains(value);
    }

    function length() external view returns (uint256) {
        return _set.length();
    }

    function valueAt(uint256 position) external view returns (address) {
        return _set.valueAt(position);
    }

    function positionOf(address value) external view returns (uint256) {
        return _set.positionOf(value);
    }

    function values() external view returns (address[] memory) {
        return _set.values();
    }
}

contract UintSetMock {
    using SetUtil for SetUtil.UintSet;

    SetUtil.UintSet private _set;

    function add(uint256 value) external {
        _set.add(value);
    }

    function remove(uint256 value) external {
        _set.remove(value);
    }

    function replace(uint256 value, uint256 newValue) external {
        _set.replace(value, newValue);
    }

    function contains(uint256 value) external view returns (bool) {
        return _set.contains(value);
    }

    function length() external view returns (uint256) {
        return _set.length();
    }

    function valueAt(uint256 position) external view returns (uint256) {
        return _set.valueAt(position);
    }

    function positionOf(uint256 value) external view returns (uint256) {
        return _set.positionOf(value);
    }

    function values() external view returns (uint256[] memory) {
        return _set.values();
    }
}
