//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/proxy/UUPSImplementation.sol";
import "@synthetixio/core-contracts/contracts/ownership/Ownable.sol";
import "@synthetixio/core-contracts/contracts/ownership/Authorizable.sol";
import "@synthetixio/core-contracts/contracts/token/ERC20.sol";
import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";

contract SNXToken is ERC20, UUPSImplementation, Ownable, Authorizable {
    address private _minterSystem;

    function initialize(
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals
    ) public onlyOwner {
        _initialize(tokenName, tokenSymbol, tokenDecimals);
    }

    function upgradeTo(address newImplementation) public override onlyOwner {
        _upgradeTo(newImplementation);
    }

    function mint(address recipient, uint256 amount) external onlyAuthorized {
        _mint(recipient, amount);
    }
}
