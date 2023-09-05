//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/proxy/UUPSImplementation.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";

contract UpgradeModule is UUPSImplementation {
    function upgradeTo(address newImplementation) public override {
        OwnableStorage.onlyOwner();
        _upgradeTo(newImplementation);
    }
}
