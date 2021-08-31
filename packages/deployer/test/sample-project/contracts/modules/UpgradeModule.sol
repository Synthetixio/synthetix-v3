//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../mixins/OwnerMixin.sol";
import "../storage/ProxyNamespace.sol";
////////////////////////////////////////////////////////////////
// WARNING DON'T USE THIS CONTRACT IN PRODUCTION ENVIRONMENTS //
////////////////////////////////////////////////////////////////
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
        // WARNING: This contract is brickable. 
        // In production you should check the newImplementation is upgradeable too

        _setImplementation(newImplementation);
    }

    /* VIEW FUNCTIONS */

    function isUpgradeable() public pure returns (bool) {
        return true;
    }

    function getImplementation() public view returns (address) {
        return _getImplementation();
    }
}