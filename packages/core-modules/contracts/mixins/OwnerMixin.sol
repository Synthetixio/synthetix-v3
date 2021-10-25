//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "../storage/OwnerStorage.sol";

contract OwnerMixin is OwnableMixin, OwnerStorage {
    function _getOwner() internal view override returns (address) {
        return _ownerStorage().owner;
    }
}
