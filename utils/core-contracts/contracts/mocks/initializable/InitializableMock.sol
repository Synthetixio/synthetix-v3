//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../../initializable/InitializableMixin.sol";

contract InitializableMock is InitializableMixin {
    bool private _initialized;
    uint256 private _value;
    uint256 private _nonCriticalValue;

    function _isInitialized() internal view override returns (bool) {
        return _initialized;
    }

    function initializeInitializableMock(uint256 initialValue) public onlyIfNotInitialized {
        _value = initialValue;

        _initialized = true;
    }

    function isInitializableMockInitialized() public view returns (bool) {
        return _isInitialized();
    }

    function doubleValue() public onlyIfInitialized {
        _value *= 2;
    }

    function getValue() public view onlyIfInitialized returns (uint256) {
        return _value;
    }

    function getNonCriticalValue() public view returns (uint256) {
        return _nonCriticalValue;
    }

    function setNonCriticalValue(uint256 nonCriticalValue) public {
        _nonCriticalValue = nonCriticalValue;
    }
}
