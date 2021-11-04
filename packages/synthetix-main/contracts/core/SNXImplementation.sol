//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/proxy/UUPSImplementation.sol";
import "../storage/SNXStorage.sol";

contract SNXImplementation is SNXStorage, OwnableMixin, UUPSImplementation {
    error alreadyInitialized();

    function initialize(address owner) public {
        if (_snxStorage().initialized) {
            revert alreadyInitialized();
        }
        _snxStorage().owner = owner;
        _snxStorage().initialized = true;
    }

    function _getOwner() internal view override returns (address) {
        return _snxStorage().owner;
    }

    function upgradeTo(address newImplementation) public override onlyOwner {
        _upgradeTo(newImplementation);
    }
}
