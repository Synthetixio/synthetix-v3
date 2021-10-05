//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../mixins/OwnerModuleMixin.sol";
import "../storage/ProxyNamespace.sol";

contract UpgradeModule is ProxyNamespace, OwnerModuleMixin {
    event Upgraded(address implementation);

    function upgradeTo(address newImplementation) public onlyOwner {
        require(newImplementation != address(0), "Implementation is zero address");
        require(_isContract(newImplementation), "Implementation not a contract");
        require(_canUpgradeInTheFuture(newImplementation), "Implementation is sterile");

        _setImplementation(newImplementation);

        emit Upgraded(newImplementation);
    }

    function _canUpgradeInTheFuture(address newImplementation) private returns (bool) {
        if (newImplementation == getImplementation()) {
            return true;
        }

        // Simulate upgrading to this implementation and then rolling back to the current one.
        // NOTE: This call will always revert, and thus will have no side effects.
        (bool success, bytes memory response) = address(this).delegatecall(
            abi.encodeWithSignature("simulateUpgrades", newImplementation)
        );

        // The simulation is expected to revert!
        if (success) {
            return false;
        }

        // The revert reason is expected to be "upgrades correctly"
        return keccak256(abi.encodePacked(string(response))) == keccak256(abi.encodePacked("upgrades correctly"));
    }

    function simulateUpgrades(address newImplementation) public {
        address oldImplementation = getImplementation();

        // Set the implementation, and then use it to roll back to the old implementation
        _setImplementation(newImplementation);
        (bool rollbackSuccessful, ) = newImplementation.delegatecall(
            abi.encodeWithSignature("upgradeTo", oldImplementation)
        );

        if (!rollbackSuccessful) {
            revert("will revert on upgrade");
        }

        if (getImplementation() != oldImplementation) {
            revert("incorrectly sets implementation");
        }

        revert("upgrades correctly");
    }

    function getImplementation() public view returns (address) {
        return _proxyStorage().implementation;
    }

    function _setImplementation(address newImplementation) private {
        _proxyStorage().implementation = newImplementation;
    }

    function _isContract(address account) private view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(account)
        }
        return size > 0;
    }
}
