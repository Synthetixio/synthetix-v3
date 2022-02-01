//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../token/ERC20HistoricalBalance.sol";

contract ERC20HistoricalBalanceMock is ERC20HistoricalBalance {
    function initialize(
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals
    ) public {
        _initialize(tokenName, tokenSymbol, tokenDecimals);
    }

    function mint(uint256 amount) external {
        _mint(msg.sender, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
