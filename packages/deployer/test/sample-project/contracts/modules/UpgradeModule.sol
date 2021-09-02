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

        _proxyStorage().implementation = newImplementation;

        if (!_proxyStorage().validatingUpgrade) {
            _validateUpgrade(newImplementation, oldImplementation);
            emit Upgraded(newImplementation);
        }
    }

    function _validateUpgrade(address newImplementation, address oldImplementation) private {
        _proxyStorage().validatingUpgrade = true;

        // Check that the new implementation would be
        // capable of upgrading to the old implementation.
        // Notice that this will call upgradeTo() again, but validatingUpgrade will be false.
        (bool success, ) = newImplementation.delegatecall(abi.encodeWithSignature("upgradeTo(address)", oldImplementation));
        require(success, "UpgradeMod.: brick upgrade call");
        require(oldImplementation == getImplementation(), "UpgradeMod.: brick upgrade");

        // Ok to upgrade to the new implementation
        _proxyStorage().implementation = newImplementation;

        _proxyStorage().validatingUpgrade = false;
    }

    /* VIEW FUNCTIONS */

    function getImplementation() public view returns (address) {
        return _proxyStorage().implementation;
    }

    /* EVENTS */

    event Upgraded(address implementation);
}
