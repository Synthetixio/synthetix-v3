// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "../common/CommonErrors.sol";
import "../interfaces/IBeacon.sol";
import "../ownership/OwnableMixin.sol";
import "../utils/ContractUtil.sol";

abstract contract Beacon is IBeacon, OwnableMixin, ContractUtil, CommonErrors {
    event Upgraded(address indexed implementation);

    function getImplementation() external view override returns (address) {
        return _getImplementation();
    }

    function upgradeTo(address newImplementation) public virtual onlyOwner {
        if (newImplementation == address(0)) {
            revert InvalidAddress(newImplementation);
        }
        if (!_isContract(newImplementation)) {
            revert InvalidContract(newImplementation);
        }
        _setImplementation(newImplementation);
        emit Upgraded(newImplementation);
    }

    function _setImplementation(address newImplementation) internal virtual {}

    function _getImplementation() internal view virtual returns (address) {}
}
