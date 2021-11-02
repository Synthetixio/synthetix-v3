//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/Ownable.sol";
import "../storage/OwnerStorage.sol";

contract OwnerModule is Ownable, OwnerStorage {
    function _setOwner(address newOwner) internal override {
        _ownerStorage().owner = newOwner;
    }

    function _getOwner() internal view override returns (address) {
        return _ownerStorage().owner;
    }

    function _setNominatedOwner(address newNominatedOwner) internal override {
        _ownerStorage().nominatedOwner = newNominatedOwner;
    }

    function _getNominatedOwner() internal view override returns (address) {
        return _ownerStorage().nominatedOwner;
    }
}
