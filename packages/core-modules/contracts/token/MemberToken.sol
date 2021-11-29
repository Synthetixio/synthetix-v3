//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/proxy/UUPSImplementation.sol";
import "@synthetixio/core-contracts/contracts/ownership/Ownable.sol";
import "@synthetixio/core-contracts/contracts/token/ERC20.sol";

contract MemberToken is Ownable, UUPSImplementation, ERC20 {
    function initialize(string memory tokenName, string memory tokenSymbol) public onlyOwner {
        _initialize(tokenName, tokenSymbol, 0);
    }

    function upgradeTo(address newImplementation) public override onlyOwner {
        _upgradeTo(newImplementation);
    }
}
