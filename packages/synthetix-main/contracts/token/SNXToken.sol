//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/proxy/UUPSImplementation.sol";
import "@synthetixio/core-contracts/contracts/ownership/Ownable.sol";
import "@synthetixio/core-contracts/contracts/token/ERC20.sol";

contract SNXToken is Ownable, UUPSImplementation, ERC20 {
    function initialize(
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals
    ) public onlyOwner {
        _initialize(tokenName, tokenSymbol, tokenDecimals);
    }

    function upgradeTo(address newImplementation) public override onlyOwner {
        super.upgradeTo(newImplementation);
    }
}
