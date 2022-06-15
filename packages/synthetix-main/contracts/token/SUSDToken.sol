//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/proxy/UUPSImplementation.sol";
import "@synthetixio/core-contracts/contracts/ownership/Ownable.sol";
import "@synthetixio/core-contracts/contracts/ownership/Authorizable.sol";
import "@synthetixio/core-contracts/contracts/token/ERC20.sol";
import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import "../interfaces/ISUSDToken.sol";

contract SUSDToken is ISUSDToken, ERC20, UUPSImplementation, Ownable, Authorizable {
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

    function burn(address to, uint256 amount) external override onlyAuthorized {
        _burn(to, amount);
    }

    function mint(address to, uint256 amount) external override onlyAuthorized {
        _mint(to, amount);
    }
}
