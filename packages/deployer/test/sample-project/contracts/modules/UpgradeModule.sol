//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../mixins/OwnerMixin.sol";
import "../storage/ProxyNamespace.sol";

contract UpgradeModule is ProxyNamespace, OwnerMixin {
    /* INTERNAL VIEW FUNCTIONS */

    function _isContract(address account) internal view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(account)
        }
        return size > 0;
    }

    /* MUTATIVE FUNCTIONS */

    function upgradeTo(address newImplementation) public onlyOwner {
        require(newImplementation != address(0), "Invalid: zero address");
        require(_isContract(newImplementation), "Invalid: not a contract");

        address oldImplementation = getImplementation();

        // Do initial upgrade
        _proxyStorage().implementation = newImplementation;

        // Perform rollback if not doint it right now
        if (!_proxyStorage().rollbackTesting) {
            // Do the rollback
            _proxyStorage().rollbackTesting = true;
            (bool success, ) = newImplementation.delegatecall(
                abi.encodeWithSignature("upgradeTo(address)", oldImplementation)
            );
            require(success, "UpgradeMod.: brick upgrade call");
            _proxyStorage().rollbackTesting = false;

            // Check rollback was effective
            require(oldImplementation == getImplementation(), "UpgradeMod.: brick upgrade");

            // Finally reset to the new implementation and log the upgrade
            _proxyStorage().implementation = newImplementation;
            emit Upgraded(newImplementation);
        }
    }

    /* VIEW FUNCTIONS */

    function getImplementation() public view returns (address) {
        return _proxyStorage().implementation;
    }

    /* EVENTS */

    event Upgraded(address implementation);
}
