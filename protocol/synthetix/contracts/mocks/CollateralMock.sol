//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/token/ERC20.sol";

contract CollateralMock is ERC20 {
    function initialize(
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals
    ) public payable {
        _initialize(tokenName, tokenSymbol, tokenDecimals);
    }

    function burn(uint256 amount) external payable {
        _burn(msg.sender, amount);
    }

    function mint(address recipient, uint256 amount) external payable {
        _mint(recipient, amount);
    }
}
