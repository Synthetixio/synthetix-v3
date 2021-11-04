//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../utils/ContractUtil.sol";
import "../utils/TransformUtil.sol";
import "../common/CommonErrors.sol";

contract ProxyStorage {
    struct ProxyNamespace {
        address implementation;
        bool simulatingUpgrade;
    }

    function _getProxyStorage() internal pure returns (ProxyNamespace storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.v3.core-contracts.proxy")) - 1)
            store.slot := 0xd3daca0a6d7491bc2d56eb9cc5d57a44c6b4ef14a20af389ba5d245f0f5b351d
        }
    }
}

abstract contract UUPSImplementation is ProxyStorage, ContractUtil, TransformUtil, CommonErrors {
    error ImplementationIsSterile(address implementation);

    event Upgraded(address implementation);

    function _setImplementation(address newImplementation) internal virtual {
        _getProxyStorage().implementation = newImplementation;
    }

    function _getImplementation() internal view virtual returns (address) {
        return _getProxyStorage().implementation;
    }

    function _setSimulatingUpgrade(bool simulatingUpgrade) internal virtual {
        _getProxyStorage().simulatingUpgrade = simulatingUpgrade;
    }

    function _getSimulatingUpgrade() internal view virtual returns (bool) {
        return _getProxyStorage().simulatingUpgrade;
    }

    function upgradeTo(address newImplementation) public virtual;

    function _upgradeTo(address newImplementation) internal {
        if (newImplementation == address(0)) {
            revert InvalidAddress(newImplementation);
        }
        if (!_isContract(newImplementation)) {
            revert InvalidContract(newImplementation);
        }
        if (!_canUpgradeInTheFuture(newImplementation)) {
            revert ImplementationIsSterile(newImplementation);
        }

        _setImplementation(newImplementation);

        emit Upgraded(newImplementation);
    }

    function _canUpgradeInTheFuture(address newImplementation) private returns (bool) {
        if (_getSimulatingUpgrade()) {
            return true;
        }
        _setSimulatingUpgrade(true);

        // Simulate upgrading to this implementation and then rolling back to the current one.
        // NOTE: This call will always revert, and thus will have no side effects.
        (bool success, bytes memory response) = address(this).delegatecall(
            abi.encodeWithSelector(this.simulateUpgrades.selector, newImplementation)
        );

        _setSimulatingUpgrade(false);

        // The simulation is expected to revert!
        if (success) {
            return false;
        }

        // The revert reason is expected to be "upgrades correctly"
        return
            keccak256(abi.encodePacked(_revertReasonFromBytes(response))) ==
            keccak256(abi.encodePacked("upgrades correctly"));
    }

    function simulateUpgrades(address newImplementation) public {
        address oldImplementation = _getImplementation();

        // Set the implementation, and then use it to roll back to the old implementation
        _setImplementation(newImplementation);
        (bool rollbackSuccessful, ) = newImplementation.delegatecall(
            abi.encodeWithSelector(this.upgradeTo.selector, oldImplementation)
        );

        if (!rollbackSuccessful) {
            revert("will revert on upgrade");
        }

        if (_getImplementation() != oldImplementation) {
            revert("incorrectly sets implementation");
        }

        revert("upgrades correctly");
    }
}
