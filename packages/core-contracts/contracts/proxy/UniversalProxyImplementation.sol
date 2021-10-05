//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../utils/ContractUtil.sol";
import "hardhat/console.sol";

abstract contract UniversalProxyImplementation is ContractUtil {
    event Upgraded(address implementation);

    function _setImplementation(address newImplementation) internal virtual;

    function _getImplementation() internal view virtual returns (address);

    function upgradeTo(address newImplementation) public virtual;

    function _upgradeTo(address newImplementation) internal {
        require(newImplementation != address(0), "Implementation is zero address");
        require(_isContract(newImplementation), "Implementation not a contract");
        require(_canUpgradeInTheFuture(newImplementation), "Implementation is sterile");

        _setImplementation(newImplementation);

        emit Upgraded(newImplementation);
    }

    function _canUpgradeInTheFuture(address newImplementation) private returns (bool) {
        console.log("_canUpgradeInTheFuture: newImplementation", newImplementation);
        console.log("_canUpgradeInTheFuture: _getImplementation", _getImplementation());
        if (newImplementation == _getImplementation()) {
            return true;
        }

        // Simulate upgrading to this implementation and then rolling back to the current one.
        // NOTE: This call will always revert, and thus will have no side effects.
        (bool success, bytes memory response) = address(this).delegatecall(
            abi.encodeWithSignature("simulateUpgrades", newImplementation)
        );

        console.log("_canUpgradeInTheFuture: Success", success);
        console.log("_canUpgradeInTheFuture: Response", string(response));
        console.logBytes(response);
        console.log("_canUpgradeInTheFuture: Done");

        // The simulation is expected to revert!
        if (success) {
            return false;
        }

        // The revert reason is expected to be "upgrades correctly"
        return keccak256(abi.encodePacked(string(response))) == keccak256(abi.encodePacked("upgrades correctly"));
    }

    function simulateUpgrades(address newImplementation) public {
        address oldImplementation = _getImplementation();

        // Set the implementation, and then use it to roll back to the old implementation
        _setImplementation(newImplementation);
        (bool rollbackSuccessful, ) = newImplementation.delegatecall(
            abi.encodeWithSignature("upgradeTo", oldImplementation)
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
