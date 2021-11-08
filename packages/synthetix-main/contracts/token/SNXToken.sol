//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/proxy/UUPSImplementation.sol";
import "@synthetixio/core-contracts/contracts/ownership/Ownable.sol";

contract SNXToken is Ownable, UUPSImplementation {
    function upgradeTo(address newImplementation) public onlyOwner {
        _upgradeTo(newImplementation);
    }
}
