//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "../storage/OwnerNamespace.sol";

contract OwnerMixin is OwnableMixin, OwnerNamespace {
    function _getOwner() internal view override returns (address) {
        return _ownerStorage().owner;
    }
}
