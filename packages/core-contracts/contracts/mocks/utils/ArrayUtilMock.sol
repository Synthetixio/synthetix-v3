//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../utils/ArrayUtil.sol";

contract ArrayUtilMock {
    address[] _values;
    mapping(address => uint) _positions;

    function addValue(address value) public {
        _values.push(value);
        _positions[value] = _values.length;
    }

    function removeValue(address value) public {
        ArrayUtil.removeValue(value, _values, _positions);
    }

    function valueAtIndex(uint index) public view returns (address) {
        return _values[index];
    }

    function positionForValue(address value) public view returns (uint) {
        return _positions[value];
    }

    function numValues() public view returns (uint) {
        return _values.length;
    }
}
