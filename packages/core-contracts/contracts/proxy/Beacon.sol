// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "../interfaces/IBeacon.sol";
import "../ownership/OwnableMixin.sol";

abstract contract Beacon is IBeacon, OwnableMixin {
    event Upgraded(address indexed implementation);

    function getImplementation() external view override returns (address) {
        return _getImplementation();
    }

    function upgradeTo(address newImplementation) public virtual onlyOwner {
        _setImplementation(newImplementation);
        emit Upgraded(newImplementation);
    }

    function _setImplementation(address newImplementation) internal virtual {}

    function _getImplementation() internal view virtual returns (address) {}
}
