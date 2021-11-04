//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../utils/ContractUtil.sol";
import "../utils/TransformUtil.sol";
import "../common/CommonErrors.sol";
import "./ProxyStorage.sol";

abstract contract UUPSImplementation is ProxyStorage, ContractUtil, TransformUtil, CommonErrors {
    error ImplementationIsSterile(address implementation);

    event Upgraded(address implementation);

    function upgradeTo(address newImplementation) public virtual {
        if (newImplementation == address(0)) {
            revert InvalidAddress(newImplementation);
        }
        if (!_isContract(newImplementation)) {
            revert InvalidContract(newImplementation);
        }
        // if (!_canUpgradeInTheFuture(newImplementation)) {
        //     revert ImplementationIsSterile(newImplementation);
        // }

        _proxyStorage().implementation = newImplementation;

        emit Upgraded(newImplementation);
    }

    // function _canUpgradeInTheFuture(address newImplementation) private returns (bool) {
    //     if (_getSimulatingUpgrade()) {
    //         return true;
    //     }
    //     _setSimulatingUpgrade(true);

    //     // Simulate upgrading to this implementation and then rolling back to the current one.
    //     // NOTE: This call will always revert, and thus will have no side effects.
    //     (bool success, bytes memory response) = address(this).delegatecall(
    //         abi.encodeWithSelector(this.simulateUpgrades.selector, newImplementation)
    //     );

    //     _setSimulatingUpgrade(false);

    //     // The simulation is expected to revert!
    //     if (success) {
    //         return false;
    //     }

    //     // The revert reason is expected to be "upgrades correctly"
    //     return
    //         keccak256(abi.encodePacked(_revertReasonFromBytes(response))) ==
    //         keccak256(abi.encodePacked("upgrades correctly"));
    // }

    // function simulateUpgrades(address newImplementation) public {
    //     address oldImplementation = _getImplementation();

    //     // Set the implementation, and then use it to roll back to the old implementation
    //     _setImplementation(newImplementation);
    //     (bool rollbackSuccessful, ) = newImplementation.delegatecall(
    //         abi.encodeWithSelector(this.upgradeTo.selector, oldImplementation)
    //     );

    //     if (!rollbackSuccessful) {
    //         revert("will revert on upgrade");
    //     }

    //     if (_getImplementation() != oldImplementation) {
    //         revert("incorrectly sets implementation");
    //     }

    //     revert("upgrades correctly");
    // }

    // function _getImplementation() internal view returns (address) {
    //     return _proxyStorage().implementation;
    // }

    // function _setSimulatingUpgrade(bool simulatingUpgrade) internal {
    //     _proxyStorage().simulatingUpgrade = simulatingUpgrade;
    // }

    // function _getSimulatingUpgrade() internal view returns (bool) {
    //     return _proxyStorage().simulatingUpgrade;
    // }
}
