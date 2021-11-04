//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/proxy/UUPSImplementation.sol";
import "../mixins/OwnerMixin.sol";

contract UpgradeModule is UUPSImplementation, OwnerMixin {
    function upgradeTo(address newImplementation) public override onlyOwner {
        _upgradeTo(newImplementation);
    }

    function getImplementation() public view returns (address) {
        return _getImplementation();
    }
}
