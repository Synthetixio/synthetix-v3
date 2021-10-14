//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../token/ERC20.sol";

contract ERC20Mock is ERC20 {
    // solhint-disable no-empty-blocks
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals
    ) ERC20(name, symbol, decimals) {}

    // solhint-enable

    function mint(uint256 amount) external {
        _mint(msg.sender, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
