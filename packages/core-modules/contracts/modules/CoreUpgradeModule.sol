//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/proxy/UUPSImplementation.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";

contract CoreUpgradeModule is UUPSImplementation, OwnableMixin {
    function upgradeTo(address newImplementation) public onlyOwner {
        _upgradeTo(newImplementation);
    }
}
